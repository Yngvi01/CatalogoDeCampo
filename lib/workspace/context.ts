import { AsyncLocalStorage } from "node:async_hooks";
export const legacyOrganizationId = "00000000-0000-0000-0000-000000000001";
export type Role = "owner" | "admin" | "member" | "viewer";
export type WorkspaceIdentity = { userId: string; organizationId?: string; role?: Role };
const context = new AsyncLocalStorage<WorkspaceIdentity>();
export const professionalAuth = () => process.env.CAMPO_AUTH === "supabase";
export const workspaceIdentity = () => context.getStore();
export function requireIdentity() {
  const identity = workspaceIdentity();
  if (!identity?.userId) throw new Error("Sessão expirada. Entre novamente.");
  return identity;
}
export function requireOrganization() {
  const identity = requireIdentity();
  if (!identity.organizationId) throw new Error("Escolha uma organização.");
  return identity.organizationId;
}
export function withIdentity<T>(identity: WorkspaceIdentity, fn: () => T): T {
  return context.run(identity, fn);
}
export const scopeId = () => professionalAuth() ? `${requireIdentity().userId}:${requireOrganization()}` : null;
export function canWrite(role: Role) { return role !== "viewer"; }
export function canManage(role: Role) { return role === "owner" || role === "admin"; }
export function storagePrefix() {
  if (!professionalAuth()) return "";
  const organization = requireOrganization();
  // Existing files are retained in their original location for the quarantined legacy catalog only.
  return organization === legacyOrganizationId ? "" : `organizations/${organization}/`;
}
