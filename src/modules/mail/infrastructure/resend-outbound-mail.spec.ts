import { ResendOutboundMail } from './resend-outbound-mail';

describe('ResendOutboundMail', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends text mail with the durable message ID as its idempotency key', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ id: 'provider-email-id' }));
    const adapter = createAdapter();

    await adapter.send({
      to: 'person@example.com',
      subject: 'Verify your email',
      text: 'Follow the verification link.',
      messageId: '<delivery-id@mail.example.com>',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(new Headers(request?.headers).get('Idempotency-Key')).toBe(
      '<delivery-id@mail.example.com>',
    );
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    if (typeof request?.body !== 'string') {
      throw new Error('Expected the Resend SDK to serialize a JSON body.');
    }
    expect(JSON.parse(request.body)).toEqual({
      from: 'Nexora Platform <mail@example.com>',
      to: 'person@example.com',
      subject: 'Verify your email',
      text: 'Follow the verification link.',
    });
  });

  it('rejects when Resend returns an API error result', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        jsonResponse(
          { name: 'validation_error', message: 'Invalid sender.' },
          422,
        ),
      );

    await expect(
      createAdapter().send({
        to: 'person@example.com',
        subject: 'Subject',
        text: 'Body',
      }),
    ).rejects.toThrow('Resend rejected the outbound email.');
  });
});

/** Builds the adapter with non-secret deterministic provider configuration. */
function createAdapter(): ResendOutboundMail {
  return new ResendOutboundMail({
    emailFrom: 'Nexora Platform <mail@example.com>',
    resendApiKey: 're_test_key',
    resendTimeoutMs: 5_000,
  });
}

/** Creates the JSON response shape used by the Resend SDK. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
