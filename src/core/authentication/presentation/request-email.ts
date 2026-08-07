export function readNormalizedEmail(body: unknown): string | undefined {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof body.email !== 'string'
  ) {
    return undefined;
  }

  return body.email.trim().toLocaleLowerCase('en-US').slice(0, 254);
}
