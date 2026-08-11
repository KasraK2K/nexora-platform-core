import { z } from 'zod';

export const updateOwnProfileSchema = z
  .object({ displayName: z.string().trim().min(1).max(100) })
  .strict();

export type UpdateOwnProfileRequest = z.infer<typeof updateOwnProfileSchema>;
