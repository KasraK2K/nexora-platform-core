import { Injectable } from '@nestjs/common';
import { verify } from 'argon2';
import type { PasswordVerifier } from '../application/password-verifier.port';

// An absent identity still performs the same Argon2 operation as a known one.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$m6TgZh+TYlE0sbmXNwsuIw$01f3hHVKm4WKs5fNxApXV9euvbv1DcLnMNRCVNrwy1Y';

@Injectable()
export class Argon2PasswordVerifier implements PasswordVerifier {
  matches(password: string, passwordHash: string | null): Promise<boolean> {
    return verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
  }
}
