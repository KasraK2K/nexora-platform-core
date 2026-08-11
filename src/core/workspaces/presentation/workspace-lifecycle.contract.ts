import { z } from 'zod';

export const renameCurrentWorkspaceSchema = z
  .object({ name: z.string().trim().min(1).max(120) })
  .strict();

export type RenameCurrentWorkspaceRequest = z.infer<
  typeof renameCurrentWorkspaceSchema
>;
