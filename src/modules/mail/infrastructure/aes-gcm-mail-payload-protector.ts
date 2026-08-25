import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config';
import type { MailPayloadProtector } from '../ports/mail-payload-protector.port';

/**
 * Protects stored mail with the configured AES-256-GCM key and binds ciphertext
 * to its message ID. The current `v1` format supports one active key.
 */
@Injectable()
export class AesGcmMailPayloadProtector implements MailPayloadProtector {
  constructor(private readonly config: AppConfig) {}

  /** Produces a versioned base64url envelope with a fresh nonce and auth tag. */
  protect(messageId: string, plaintext: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      this.config.mailOutboxEncryptionKey,
      nonce,
    );
    cipher.setAAD(Buffer.from(messageId));
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      nonce.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  /** Authenticates and decrypts a valid `v1` envelope for the same message ID. */
  unprotect(messageId: string, protectedValue: string): string {
    const [version, nonce, tag, ciphertext, extra] = protectedValue.split('.');
    if (version !== 'v1' || !nonce || !tag || !ciphertext || extra) {
      throw new Error('Invalid protected mail payload');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.config.mailOutboxEncryptionKey,
      Buffer.from(nonce, 'base64url'),
    );
    decipher.setAAD(Buffer.from(messageId));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
