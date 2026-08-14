/** Injection token for encryption of sensitive durable mail content. */
export const MAIL_PAYLOAD_PROTECTOR = Symbol('MAIL_PAYLOAD_PROTECTOR');

/** Protects mail content before storage and authenticates it when reading. */
export interface MailPayloadProtector {
  /** Encrypts and authenticates plaintext, binding it to one message ID. */
  protect(messageId: string, plaintext: string): string;
  /** Returns authenticated plaintext or throws if the value was altered or invalid. */
  unprotect(messageId: string, protectedValue: string): string;
}
