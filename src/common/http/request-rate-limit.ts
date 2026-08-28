import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

type RateLimitDecision = Readonly<{
  allowed: boolean;
  retryAfterSeconds: number;
}>;

type RateLimitDenial = Readonly<{
  code: string;
  message: string;
}>;

type RequestRateLimit = Readonly<{
  context: ExecutionContext;
  check: (request: Request) => Promise<RateLimitDecision>;
  unavailableError: () => Error;
  denial: RateLimitDenial;
}>;

/** Resolves the same bounded client address used by every HTTP rate limit. */
export function readClientIp(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

/**
 * Applies one named workflow's rate-limit decision and preserves its stable
 * availability and 429 responses. Feature guards supply only scoped policy.
 */
export async function enforceRequestRateLimit(
  input: RequestRateLimit,
): Promise<boolean> {
  const http = input.context.switchToHttp();
  const request = http.getRequest<Request>();
  let decision: RateLimitDecision;
  try {
    decision = await input.check(request);
  } catch {
    throw input.unavailableError();
  }
  if (decision.allowed) return true;

  http
    .getResponse<Response>()
    .setHeader('retry-after', decision.retryAfterSeconds.toString());
  throw new HttpException(
    {
      ...input.denial,
      retryable: true,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
