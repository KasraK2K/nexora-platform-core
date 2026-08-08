import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export type EmailVerificationToken = { raw: string; hash: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

@Injectable()
export class EmailVerificationTokenService {
  create(): EmailVerificationToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  hashIfValid(raw: string): string | undefined {
    return TOKEN_PATTERN.test(raw) ? this.hash(raw) : undefined;
  }

  private hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
