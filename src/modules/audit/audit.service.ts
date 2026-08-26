import { Injectable } from '@nestjs/common';
import { AuditRepository } from './audit.repository';
import type { AppendAuditLog } from './audit.types';

export type { AppendAuditLog } from './audit.types';

/** Records workspace-scoped security facts through the active transaction. */
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  /** Appends an immutable audit fact atomically with the caller's state change. */
  append(input: AppendAuditLog): Promise<void> {
    return this.repository.append(input);
  }
}
