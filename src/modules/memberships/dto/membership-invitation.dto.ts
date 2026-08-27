import { z } from 'zod';
import { normalizeUserEmail } from '../../users/users.service';

/** Validates and normalizes a request to invite one workspace member. */
export const createMembershipInvitationSchema = z
  .object({
    email: z.string().transform(normalizeUserEmail).pipe(z.email().max(254)),
  })
  .strict();

/** Normalized request accepted by the invitation creation endpoint. */
export type CreateMembershipInvitationDto = z.infer<
  typeof createMembershipInvitationSchema
>;

/**
 * Validates the token's fixed transport length. The token service later hashes
 * the opaque value; this schema does not claim to validate its character set.
 */
export const acceptMembershipInvitationSchema = z
  .object({ token: z.string().length(43) })
  .strict();

/** Request accepted by the invitation acceptance endpoint. */
export type AcceptMembershipInvitationDto = z.infer<
  typeof acceptMembershipInvitationSchema
>;
