/**
 * Safely extracts a bounded normalized email for pre-validation rate limiting.
 * This helper does not replace the route's Zod validation.
 */
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
