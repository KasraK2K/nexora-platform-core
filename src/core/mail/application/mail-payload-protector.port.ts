export const MAIL_PAYLOAD_PROTECTOR = Symbol('MAIL_PAYLOAD_PROTECTOR');

export interface MailPayloadProtector {
  protect(messageId: string, plaintext: string): string;
  unprotect(messageId: string, protectedValue: string): string;
}
