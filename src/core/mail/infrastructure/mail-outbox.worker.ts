import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { MailOutbox } from '../application/mail-outbox';

/**
 * Polls the durable mail outbox without overlapping drain runs and makes a
 * bounded attempt to finish an active run during graceful shutdown.
 */
@Injectable()
export class MailOutboxWorker
  implements
    OnApplicationBootstrap,
    BeforeApplicationShutdown,
    OnApplicationShutdown
{
  private readonly logger = new Logger(MailOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<void>;

  constructor(
    private readonly outbox: MailOutbox,
    private readonly config: AppConfig,
  ) {}

  /** Starts polling when enabled and performs the first drain immediately. */
  onApplicationBootstrap(): void {
    if (!this.config.mailWorkerEnabled) return;
    this.timer = setInterval(
      () => this.runOnce(),
      this.config.mailPollIntervalMs,
    );
    this.timer.unref();
    this.runOnce();
  }

  /** Stops scheduling new drain runs before dependencies begin shutting down. */
  beforeApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Waits for the active drain or the configured shutdown timeout. */
  async onApplicationShutdown(): Promise<void> {
    if (!this.running) return;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([
      this.running,
      new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          this.logger.warn(
            JSON.stringify({ event: 'mail.shutdown_drain_timed_out' }),
          );
          resolve();
        }, this.config.shutdownTimeoutMs);
        timer.unref();
      }),
    ]);
    if (timer) clearTimeout(timer);
  }

  /** Starts one drain only when no previous drain is still running. */
  private runOnce(): void {
    if (this.running) return;
    this.running = this.outbox
      .drainDue()
      .catch((error: unknown) => {
        this.logger.error(
          JSON.stringify({
            event: 'mail.outbox_poll_failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
      })
      .finally(() => {
        this.running = undefined;
      });
  }
}
