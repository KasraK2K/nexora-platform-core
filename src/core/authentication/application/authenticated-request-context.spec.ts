import { createAuthenticatedRequestContext } from './authenticated-request-context';

describe('createAuthenticatedRequestContext', () => {
  it('creates a minimal immutable context from server-resolved session data', () => {
    const context = {
      sessionId: '01911457-6ca2-7d29-8abe-12fe03ea401c',
      actorUserId: '01911457-9b3a-7cc3-9c3a-3b7508f69f5c',
      userStatus: 'ACTIVE' as const,
      organizationId: '01911457-c5b3-7eb8-9e52-c7b80b372506',
      workspaceId: '01911457-e820-7b71-b695-a07fb242b8ec',
    };

    const authenticated = createAuthenticatedRequestContext(context);

    expect(authenticated).toEqual(context);
    expect(Object.isFrozen(authenticated)).toBe(true);
    expect(Object.keys(authenticated).sort()).toEqual(
      [
        'actorUserId',
        'organizationId',
        'sessionId',
        'userStatus',
        'workspaceId',
      ].sort(),
    );
  });
});
