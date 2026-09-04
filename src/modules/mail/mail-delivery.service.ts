import { Inject, Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { ObservabilityService } from '../observability/observability.service';
import { OUTBOUND_MAIL, type OutboundMail } from './providers/outbound-mail';
import {
  type ClaimedMail,
  MailOutboxRepository,
} from './repositories/mail-outbox.repository';
import {
  MAIL_PAYLOAD_PROTECTOR,
  type MailPayloadProtector,
} from './security/mail-payload-protector';

type ProtectedMailPayload = Readonly<{
  to: string;
  subject: string;
  text: string;
}>;

type LeaseHeartbeat = Readonly<{
  stop(): Promise<boolean>;
}>;

/** Private worker-side policy for leased delivery of durable mail. */
@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger('MailOutbox');

  constructor(
    private readonly repository: MailOutboxRepository,
    @Inject(MAIL_PAYLOAD_PROTECTOR)
    private readonly protector: MailPayloadProtector,
    @Inject(OUTBOUND_MAIL) private readonly outboundMail: OutboundMail,
    private readonly config: AppConfig,
    private readonly telemetry: ObservabilityService,
  ) {}

  /**
   * Attempts one leased delivery and records sent, retry, or terminal failure.
   * Returning `false` never removes a committed business change. Delivery is
   * at-least-once beyond Resend's idempotency window: a crash after provider
   * acceptance but before `markSent` can cause a later resend with the same
   * Message-ID.
   */
  async deliverNow(id: string): Promise<boolean> {
    const now = new Date();
    let claimed;
    try {
      claimed = await this.repository.claim(
        id,
        now,
        new Date(now.getTime() + this.config.mailClaimTtlMs),
        this.config.mailMaxAttempts,
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'mail.delivery_claim_failed',
          deliveryId: id,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      return false;
    }
    if (!claimed) return false;

    try {
      const payload = readPayload(
        this.protector.unprotect(claimed.id, claimed.encryptedPayload),
      );
      const heartbeat = this.startLeaseHeartbeat(claimed);
      let delivered = false;
      let deliveryError: unknown;
      try {
        await this.outboundMail.send({
          ...payload,
          messageId: claimed.messageId,
        });
        delivered = true;
      } catch (error) {
        deliveryError = error;
      }
      if (!(await heartbeat.stop())) {
        this.logger.warn(
          JSON.stringify({
            event: 'mail.delivery_lease_lost',
            deliveryId: claimed.id,
            correlationId: claimed.correlationId,
            attempt: claimed.attemptCount,
          }),
        );
        return false;
      }
      if (!delivered) {
        return this.recordDeliveryFailure(claimed, deliveryError);
      }
      await this.repository.markSent({
        id: claimed.id,
        attemptCount: claimed.attemptCount,
        sentAt: new Date(),
      });
      this.telemetry.recordMailDelivery('sent');
      return true;
    } catch (error) {
      return this.recordDeliveryFailure(claimed, error);
    }
  }

  /** Expires old messages and attempts a bounded, sequential batch of due IDs. */
  async drainDue(limit = 20): Promise<void> {
    const now = new Date();
    await this.repository.expireDue(now, this.config.mailMaxAttempts);
    const ids = await this.repository.findDueIds(
      now,
      limit,
      this.config.mailMaxAttempts,
    );
    for (const id of ids) await this.deliverNow(id);
  }

  /** Records retry or terminal state for a failed claimed delivery attempt. */
  private async recordDeliveryFailure(
    claimed: ClaimedMail,
    error: unknown,
  ): Promise<false> {
    const attemptedAt = new Date();
    try {
      if (
        claimed.attemptCount >= this.config.mailMaxAttempts ||
        claimed.expiresAt <= attemptedAt
      ) {
        await this.repository.markFailed({
          id: claimed.id,
          attemptCount: claimed.attemptCount,
          failedAt: attemptedAt,
        });
        this.telemetry.recordMailDelivery('failed');
      } else {
        const delay = Math.min(
          this.config.mailRetryMaxMs,
          this.config.mailRetryBaseMs * 2 ** (claimed.attemptCount - 1),
        );
        await this.repository.markRetry({
          id: claimed.id,
          attemptCount: claimed.attemptCount,
          attemptedAt,
          nextAttemptAt: new Date(attemptedAt.getTime() + delay),
        });
        this.telemetry.recordMailDelivery('retry');
      }
    } catch (stateError) {
      this.logger.error(
        JSON.stringify({
          event: 'mail.delivery_state_update_failed',
          deliveryId: claimed.id,
          correlationId: claimed.correlationId,
          errorType:
            stateError instanceof Error ? stateError.name : 'UnknownError',
        }),
      );
    }
    this.logger.warn(
      JSON.stringify({
        event: 'mail.delivery_attempt_failed',
        deliveryId: claimed.id,
        correlationId: claimed.correlationId,
        attempt: claimed.attemptCount,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }),
    );
    return false;
  }

  /** Keeps a long provider call owned by this attempt without crossing expiry. */
  private startLeaseHeartbeat(claimed: ClaimedMail): LeaseHeartbeat {
    const intervalMs = Math.max(1, Math.floor(this.config.mailClaimTtlMs / 3));
    const repository = this.repository;
    const logger = this.logger;
    const claimTtlMs = this.config.mailClaimTtlMs;
    let timer: NodeJS.Timeout | undefined;
    let renewal: Promise<void> | undefined;
    let stopped = false;
    let retained = true;
    let retainedUntil = new Date(
      Math.min(claimed.lockedUntil.getTime(), claimed.expiresAt.getTime()),
    );

    /** Schedules another non-overlapping renewal while the send is pending. */
    function schedule(): void {
      if (stopped || !retained) return;
      const remainingMs = claimed.expiresAt.getTime() - Date.now();
      if (remainingMs <= 0) {
        retained = false;
        return;
      }
      timer = setTimeout(renew, Math.min(intervalMs, remainingMs));
      timer.unref();
    }

    /** Renews the fenced generation and then schedules its next heartbeat. */
    function renew(): void {
      if (stopped || !retained || renewal) return;
      const now = new Date();
      const lockedUntil = new Date(
        Math.min(now.getTime() + claimTtlMs, claimed.expiresAt.getTime()),
      );
      if (lockedUntil <= now) {
        retained = false;
        return;
      }
      renewal = repository
        .renewLease({
          id: claimed.id,
          attemptCount: claimed.attemptCount,
          now,
          lockedUntil,
        })
        .then((renewed) => {
          retained = renewed;
          if (renewed) retainedUntil = lockedUntil;
        })
        .catch((error: unknown) => {
          retained = false;
          logger.error(
            JSON.stringify({
              event: 'mail.delivery_lease_renewal_failed',
              deliveryId: claimed.id,
              correlationId: claimed.correlationId,
              attempt: claimed.attemptCount,
              errorType: error instanceof Error ? error.name : 'UnknownError',
            }),
          );
        })
        .finally(() => {
          renewal = undefined;
          schedule();
        });
    }

    schedule();
    return {
      stop: async () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        await renewal;
        return retained && retainedUntil.getTime() > Date.now();
      },
    };
  }
}

/** Parses decrypted JSON and rejects any payload outside the expected text fields. */
function readPayload(value: string): ProtectedMailPayload {
  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('to' in parsed) ||
    typeof parsed.to !== 'string' ||
    !('subject' in parsed) ||
    typeof parsed.subject !== 'string' ||
    !('text' in parsed) ||
    typeof parsed.text !== 'string'
  ) {
    throw new Error('Invalid protected mail payload');
  }
  return { to: parsed.to, subject: parsed.subject, text: parsed.text };
}
