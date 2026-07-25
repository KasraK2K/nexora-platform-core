import { Inject, Injectable } from '@nestjs/common';

export const AUDIT_LOG_REPOSITORY = Symbol('AUDIT_LOG_REPOSITORY');

export type AppendAuditLog = {
  id: string;
  workspaceId: string;
  actorUserId: string;
  action: string;
  resourceId: string;
};

export interface AuditLogRepository {
  append(input: AppendAuditLog): Promise<void>;
}

@Injectable()
export class AuditLog {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly repository: AuditLogRepository,
  ) {}

  append(input: AppendAuditLog): Promise<void> {
    return this.repository.append(input);
  }
}
