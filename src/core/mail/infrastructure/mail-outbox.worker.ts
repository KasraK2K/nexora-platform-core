import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { AppConfig } from '../../configuration/app-config';
import { MailOutbox } from '../application/mail-outbox';

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

  onApplicationBootstrap(): void {
    if (!this.config.mailWorkerEnabled) return;
    this.timer = setInterval(
      () => this.runOnce(),
      this.config.mailPollIntervalMs,
    );
    this.timer.unref();
    this.runOnce();
  }

  beforeApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

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
