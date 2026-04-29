// TODO(codex): wire to Lovable custom domain APIs.
export type DomainStatus = "active" | "verifying" | "action-required" | "offline" | "failed";
export interface Domain { name: string; status: DomainStatus; primary: boolean; ssl: "active" | "issuing" | "failed"; addedAt: string }

export async function listDomains(_projectId: string): Promise<Domain[]> {
  return [
    { name: "portal.skky.group",     status: "active",          primary: true,  ssl: "active",  addedAt: "2026-02-01" },
    { name: "www.portal.skky.group", status: "active",          primary: false, ssl: "active",  addedAt: "2026-02-01" },
    { name: "staging.skky.group",    status: "verifying",       primary: false, ssl: "issuing", addedAt: "2026-04-28" },
  ];
}

export async function addDomain(_projectId: string, _name: string): Promise<Domain> {
  return { name: _name, status: "verifying", primary: false, ssl: "issuing", addedAt: new Date().toISOString() };
}
export async function removeDomain(_projectId: string, _name: string): Promise<void> {}
export async function setPrimary(_projectId: string, _name: string): Promise<void> {}
