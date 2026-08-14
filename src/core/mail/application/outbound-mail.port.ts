/** Injection token for the provider-neutral outbound mail adapter. */
export const OUTBOUND_MAIL = Symbol('OUTBOUND_MAIL');

/** Sends one already-rendered text email through the configured provider. */
export interface OutboundMail {
  /** Resolves after the provider accepts the message, or rejects on failure. */
  send(input: {
    to: string;
    subject: string;
    text: string;
    messageId?: string;
  }): Promise<void>;
}
