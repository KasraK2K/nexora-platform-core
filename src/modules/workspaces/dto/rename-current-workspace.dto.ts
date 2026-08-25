import { z } from 'zod';

/** Strict transport validation for active-workspace rename requests. */
export const renameCurrentWorkspaceSchema = z
  .object({ name: z.string().trim().min(1).max(120) })
  .strict();

/** Validated request shape inferred from the workspace rename schema. */
export type RenameCurrentWorkspaceDto = z.infer<
  typeof renameCurrentWorkspaceSchema
>;
