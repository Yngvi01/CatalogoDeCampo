import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { limitedJson } from "../validation/body";
import { query, transaction } from "../db";
import { requireOrganization, requireIdentity, canManage, scopeId, legacyOrganizationId } from "./context";
import { organizations, workspaceDetails } from "./service";
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
export async function workspaceHandler(request: NextRequest, action: string | undefined, email?: string) {
  const identity = requireIdentity();
  const org = requireOrganization();
  if (request.method === "GET") {
    if (action === "audit") {
      if (!canManage(identity.role!)) return json({ error: "Auditoria disponível para administradores." }, 403);
      const params = request.nextUrl.searchParams;
      const before = z.coerce.number().int().positive().optional().parse(params.get("before") || undefined);
      const entity = params.get("entity") || undefined;
      if (entity) z.string().max(200).parse(entity);
      const events = await query("SELECT id,actor_id,entity_type,entity_id,operation,before_data,after_data,occurred_at FROM audit_events WHERE organization_id=$1 AND ($2::bigint IS NULL OR id<$2) AND ($3::text IS NULL OR entity_id=$3) ORDER BY id DESC LIMIT 50", [org, before ?? null, entity ?? null]);
      return json({ events });
    }
    if (action === "members") return json(await workspaceDetails());
    return json({ professional: true, user: { id: identity.userId, email }, organizations: await organizations(), organizationId: org, role: identity.role, scope: scopeId() });
  }
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const input = await limitedJson(request);
  if (action === "create") {
    const { name } = z.object({ name: z.string().trim().min(1).max(120) }).parse(input);
    const [created] = await query<{ id: string }>("SELECT campo_create_organization($1,false) AS id", [name]);
    return json({ organizationId: created.id });
  }
  if (action === "select") {
    const { organizationId } = z.object({ organizationId: z.union([z.uuid(), z.literal(legacyOrganizationId)]) }).parse(input);
    if (!(await organizations()).some(item => item.id === organizationId)) return json({ error: "Organização não autorizada." }, 403);
    const response = json({ ok: true });
    response.cookies.set("campo-organization", organizationId, { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 604800 });
    return response;
  }
  if (action === "accept") {
    const { token } = z.object({ token: z.uuid() }).parse(input);
    const [result] = await query<{ id: string }>("SELECT campo_accept_invitation($1) AS id", [token]);
    return json({ organizationId: result.id });
  }
  if (!canManage(identity.role!)) return json({ error: "Apenas administradores podem gerenciar a equipe." }, 403);
  if (action === "invite") {
    const { email, role } = z.object({ email: z.email().max(254), role: z.enum(["admin", "member", "viewer"]) }).parse(input);
    const token = randomUUID();
    await query("SELECT campo_invite($1,$2,$3,$4)", [org, email, role, token]);
    return json({ token, expiresInDays: 7 });
  }
  if (action === "member") {
    const { userId, role } = z.object({ userId: z.uuid(), role: z.enum(["owner", "admin", "member", "viewer"]).nullable() }).parse(input);
    await transaction(() => query("SELECT campo_change_member($1,$2,$3)", [org, userId, role]));
    return json({ ok: true });
  }
  if (action === "revoke") {
    const { invitationId } = z.object({ invitationId: z.uuid() }).parse(input);
    await query("SELECT campo_revoke_invitation($1,$2)", [org, invitationId]);
    return json({ ok: true });
  }
  return json({ error: "Operação não encontrada." }, 404);
}
