import { Injectable } from '@nestjs/common';

@Injectable()
export class OperationalTelemetry {
  private readonly httpRequests = new Map<string, number>();
  private readonly dependencyChecks = new Map<string, number>();
  private readonly mailDeliveries = new Map<string, number>();

  recordHttpRequest(method: string, statusCode: number): void {
    increment(this.httpRequests, `${method}|${Math.floor(statusCode / 100)}xx`);
  }

  recordDependencyCheck(
    dependency: 'postgresql' | 'redis',
    outcome: 'up' | 'down',
  ): void {
    increment(this.dependencyChecks, `${dependency}|${outcome}`);
  }

  recordMailDelivery(outcome: 'sent' | 'retry' | 'failed'): void {
    increment(this.mailDeliveries, outcome);
  }

  renderOpenMetrics(): string {
    const lines = [
      '# HELP nexora_http_server_requests_total Completed HTTP requests.',
      '# TYPE nexora_http_server_requests_total counter',
    ];
    for (const [key, value] of [...this.httpRequests].sort()) {
      const [method, statusClass] = key.split('|');
      lines.push(
        `nexora_http_server_requests_total{method="${method}",status_class="${statusClass}"} ${value}`,
      );
    }
    lines.push(
      '# HELP nexora_dependency_checks_total Dependency readiness checks.',
      '# TYPE nexora_dependency_checks_total counter',
    );
    for (const [key, value] of [...this.dependencyChecks].sort()) {
      const [dependency, outcome] = key.split('|');
      lines.push(
        `nexora_dependency_checks_total{dependency="${dependency}",outcome="${outcome}"} ${value}`,
      );
    }
    lines.push(
      '# HELP nexora_mail_deliveries_total Durable mail delivery outcomes.',
      '# TYPE nexora_mail_deliveries_total counter',
    );
    for (const [outcome, value] of [...this.mailDeliveries].sort()) {
      lines.push(`nexora_mail_deliveries_total{outcome="${outcome}"} ${value}`);
    }
    return `${lines.join('\n')}\n# EOF\n`;
  }
}

function increment(values: Map<string, number>, key: string): void {
  values.set(key, (values.get(key) ?? 0) + 1);
}
