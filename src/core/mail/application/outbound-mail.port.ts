export const OUTBOUND_MAIL = Symbol('OUTBOUND_MAIL');

export interface OutboundMail {
  send(input: {
    to: string;
    subject: string;
    text: string;
    messageId?: string;
  }): Promise<void>;
}
