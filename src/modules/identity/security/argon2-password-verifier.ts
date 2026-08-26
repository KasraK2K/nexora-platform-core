import { Injectable } from '@nestjs/common';
import { verify } from 'argon2';
import type { PasswordVerifier } from '../security/password-verifier';

/** Valid fixed hash used so an absent identity still performs Argon2 work. */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$m6TgZh+TYlE0sbmXNwsuIw$01f3hHVKm4WKs5fNxApXV9euvbv1DcLnMNRCVNrwy1Y';

/** Argon2 adapter that preserves equivalent work for missing credentials. */
@Injectable()
export class Argon2PasswordVerifier implements PasswordVerifier {
  /** Matches against the supplied hash or a fixed valid dummy hash when absent. */
  matches(password: string, passwordHash: string | null): Promise<boolean> {
    return verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
  }
}
