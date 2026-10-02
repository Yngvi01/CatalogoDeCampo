import { query } from "../db";
import { requireIdentity, requireOrganization, type Role } from "./context";
export type Organization = { id: string; name: string; role: Role };
export async function organizations(): Promise<Organization[]> {
  return query<Organization>("SELECT o.id,o.name,m.role FROM organizations o JOIN organization_members m ON m.organization_id=o.id WHERE m.user_id=$1 ORDER BY o.created_at,o.id", [requireIdentity().userId]);
}
export async function selectOrganization(selected?: string, strict = true) {
  let items = await organizations();
  if (!items.length) {
    await query("SELECT campo_create_organization($1,true)", ["Meu espaço"]);
    items = await organizations();
  }
  // A removed membership or stale selection never silently redirects pending data to another organization.
  if (strict && selected && !items.some(item => item.id === selected)) throw new Error("Acesso à organização revogado. Escolha outro espaço.");
  return { items, active: items.find(item => item.id === selected) || items[0] };
}
export async function workspaceDetails() {
  const organization = requireOrganization();
  const [members, invitations] = await Promise.all([
    query("SELECT * FROM campo_members($1)", [organization]),
    query("SELECT id,email,role,expires_at,accepted_at FROM organization_invitations WHERE organization_id=$1 AND accepted_at IS NULL ORDER BY created_at DESC", [organization]),
  ]);
  return { members, invitations };
}
