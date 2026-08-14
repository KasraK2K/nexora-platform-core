import { Injectable } from '@nestjs/common';
import { argon2id, hash } from 'argon2';
import { PasswordHasher } from '../application/password-hasher.port';

/** Argon2id adapter using the repository's fixed password-hashing parameters. */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  /** Produces a salted Argon2id encoded hash suitable for credential storage. */
  hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }
}
