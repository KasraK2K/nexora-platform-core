import { AesGcmMailPayloadProtector } from './aes-gcm-mail-payload-protector';

describe('AesGcmMailPayloadProtector', () => {
  const protector = new AesGcmMailPayloadProtector({
    mailOutboxEncryptionKey: Buffer.alloc(32, 9),
  } as never);

  it('round-trips authenticated ciphertext without exposing plaintext', () => {
    const plaintext = 'token=raw-secret-token&email=person@example.com';
    const protectedValue = protector.protect('message-id', plaintext);
    expect(protectedValue).not.toContain('raw-secret-token');
    expect(protectedValue).not.toContain('person@example.com');
    expect(protector.unprotect('message-id', protectedValue)).toBe(plaintext);
  });

  it('rejects tampering and use under another message identity', () => {
    const protectedValue = protector.protect('message-id', 'sensitive');
    expect(() => protector.unprotect('another-id', protectedValue)).toThrow();
    expect(() =>
      protector.unprotect('message-id', `${protectedValue.slice(0, -1)}A`),
    ).toThrow();
  });
});
