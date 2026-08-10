import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class MembershipInvitationTokenService {
  create(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  hashIfValid(raw: string): string | undefined {
    return TOKEN_PATTERN.test(raw) ? this.hash(raw) : undefined;
  }

  createActiveKey(workspaceId: string, normalizedEmail: string): string {
    return this.hash(`${workspaceId}\0${normalizedEmail}`);
  }

  private hash(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
}
