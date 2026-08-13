import { Injectable, type BeforeApplicationShutdown } from '@nestjs/common';
import { DependencyHealthService } from './infrastructure/dependency-health.service';

@Injectable()
export class HealthLifecycleService implements BeforeApplicationShutdown {
  constructor(private readonly health: DependencyHealthService) {}

  beforeApplicationShutdown(): void {
    this.health.markShuttingDown();
  }
}
