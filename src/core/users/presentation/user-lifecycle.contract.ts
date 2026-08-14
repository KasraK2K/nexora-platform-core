import { z } from 'zod';

/** Strict transport validation for the bounded self-profile update payload. */
export const updateOwnProfileSchema = z
  .object({ displayName: z.string().trim().min(1).max(100) })
  .strict();

/** Validated request shape inferred from {@link updateOwnProfileSchema}. */
export type UpdateOwnProfileRequest = z.infer<typeof updateOwnProfileSchema>;
