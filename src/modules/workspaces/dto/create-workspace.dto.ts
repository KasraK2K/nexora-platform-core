import { z } from 'zod';

/** Accepts only a bounded human-readable workspace name. */
export const createWorkspaceSchema = z
  .object({ name: z.string().trim().min(1).max(120) })
  .strict();

/** Validated request used to create an independently owned workspace. */
export type CreateWorkspaceDto = z.infer<typeof createWorkspaceSchema>;
