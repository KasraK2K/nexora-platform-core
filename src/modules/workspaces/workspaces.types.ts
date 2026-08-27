/** Minimal operational-tenant view exposed to Core consumers. */
export type WorkspaceSummary = {
  id: string;
  ownerUserId: string;
  name: string;
};
