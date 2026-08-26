/** Minimal operational-tenant view exposed to Core consumers. */
export type WorkspaceSummary = {
  id: string;
  organizationId: string;
  name: string;
};
