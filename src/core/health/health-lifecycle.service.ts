import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import { DependencyHealthService } from './infrastructure/dependency-health.service';

/** Marks readiness false before Nest begins shutting down dependencies. */
@Injectable()
export class HealthLifecycleService implements BeforeApplicationShutdown {
  constructor(private readonly health: DependencyHealthService) {}

  /** Removes the process from service before connections begin closing. */
  beforeApplicationShutdown(): void {
    this.health.markShuttingDown();
  }
}
