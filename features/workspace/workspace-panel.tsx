"use client";
import { useEffect, useState } from "react";
import { api, send, Modal, ErrorText } from "@/components/shared";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/workspace/context";
const labels: Record<Role, string> = { owner: "Proprietário", admin: "Administrador", member: "Membro", viewer: "Leitor" };
type Workspace = { scope: string; user: { id: string; email: string }; organizations: { id: string; name: string; role: Role }[]; organizationId: string; role: Role };
type Team = { members: { user_id: string; email: string; role: Role }[]; invitations: { id: string; email: string; role: Role; expires_at: string }[] };
type AuditEvent = { id: string; actor_id: string | null; entity_type: string; entity_id: string; operation: string; occurred_at: string; before_data: unknown; after_data: unknown };
export function WorkspacePanel() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null), [team, setTeam] = useState<Team | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [link, setLink] = useState(""), [events, setEvents] = useState<AuditEvent[]>([]), [audit, setAudit] = useState(false);
  const [professional, setProfessional] = useState(false);
  const manage = workspace?.role === "owner" || workspace?.role === "admin";
  const load = async () => {
    const value = await api<Workspace>("workspace"); setWorkspace(value);
    setTeam(await api<Team>("workspace/members", { headers: { "X-Campo-Scope": value.scope } }));
  };
  const workspaceApi = <T,>(path: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers);
    if (workspace?.scope) headers.set("X-Campo-Scope", workspace.scope);
    return api<T>(path, { ...options, headers });
  };
  useEffect(() => {
    fetch("/api/auth").then(r => r.json()).then(async value => {
      if (!value.professional) return;
      setProfessional(true);
      if (new URLSearchParams(location.search).has("invite")) setOpen(true);
      try { await load(); } catch (cause) { setError((cause as Error).message); }
    }).catch(() => {});
  }, []);
  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  const select = async (organizationId: string) => {
    await api("workspace/select", send({ organizationId }));
    // Reload closes forms and clears data belonging to the previous organization.
    location.href = "/";
  };
  if (!professional) return null;
  return <>
    <Button variant="outline" onClick={() => { setOpen(true); void act(load); }}>{workspace?.organizations.find(o => o.id === workspace.organizationId)?.name || "Organizações"}</Button>
    {open && <Modal title="Organizações e equipe" onClose={() => setOpen(false)} wide>
      <p>{workspace?.user.email} · {workspace ? labels[workspace.role] : ""}</p>
      <ErrorText message={error} />
      <label>Organização ativa<select aria-label="Organização ativa" value={workspace?.organizationId || ""} disabled={busy || !workspace} onChange={e => void act(() => select(e.target.value))}>
        {workspace?.organizations.map(org => <option key={org.id} value={org.id}>{org.name} · {labels[org.role]}</option>)}
      </select></label>
      <Button variant="outline" disabled={busy || !workspace} onClick={() => void act(() => select(workspace!.organizationId))}>Abrir este espaço</Button>
      <form onSubmit={e => { e.preventDefault(); const name = String(new FormData(e.currentTarget).get("name")); void act(async () => { const created = await api<{ organizationId: string }>("workspace/create", send({ name })); await select(created.organizationId); }); }}>
        <label>Nome da nova organização<input name="name" required maxLength={120} /></label><Button disabled={busy}>Criar organização</Button>
      </form>
      <form onSubmit={e => { e.preventDefault(); const token = String(new FormData(e.currentTarget).get("token")); void act(async () => { const accepted = await api<{ organizationId: string }>("workspace/accept", send({ token })); await select(accepted.organizationId); }); }}>
        <label>Código do convite<input name="token" required defaultValue={typeof location !== "undefined" ? new URLSearchParams(location.search).get("invite") || "" : ""} /></label>
        <p className="muted">Entre com o e-mail confirmado ao qual o convite foi enviado.</p><Button variant="outline" disabled={busy}>Aceitar convite</Button>
      </form>
      <h3>Equipe</h3>
      <p>Leitores consultam e exportam. Membros registram e editam observações, locais e o catálogo. Administradores também gerenciam projetos, campanhas, equipe, importações e auditoria. Proprietários podem transferir a propriedade.</p>
      {team?.members.map(member => <div className="workspace-row" key={member.user_id}><span>{member.email}{member.user_id === workspace?.user.id ? " (você)" : ""}</span>
        {manage ? <><select aria-label={`Permissão de ${member.email}`} value={member.role} disabled={busy || (member.role === "owner" && workspace?.role !== "owner")} onChange={e => void act(async () => { await workspaceApi("workspace/member", send({ userId: member.user_id, role: e.target.value })); await load(); })}>
          {Object.entries(labels).filter(([role]) => role !== "owner" || workspace?.role === "owner" || member.role === "owner").map(([role, label]) => <option key={role} value={role}>{label}</option>)}
        </select><Button variant="ghost" disabled={busy || (member.role === "owner" && workspace?.role !== "owner")} onClick={() => void act(async () => { await workspaceApi("workspace/member", send({ userId: member.user_id, role: null })); await load(); })}>Remover</Button></> : <span>{labels[member.role]}</span>}
      </div>)}
      {manage && <>
        <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void act(async () => { const invite = await workspaceApi<{ token: string }>("workspace/invite", send({ email: form.get("email"), role: form.get("role") })); setLink(`${location.origin}/?invite=${invite.token}`); await load(); }); }}>
          <label>E-mail do convidado<input name="email" type="email" required maxLength={254} /></label>
          <label>Permissão do convite<select name="role" defaultValue="member"><option value="member">Membro</option><option value="viewer">Leitor</option><option value="admin">Administrador</option></select></label>
          <Button disabled={busy}>Gerar convite</Button>
        </form>
        {link && <label>Link para compartilhar com o convidado (válido por 7 dias)<input aria-label="Link do convite" readOnly value={link} onFocus={e => e.target.select()} /></label>}
        {team?.invitations.map(invite => <div key={invite.id} className="workspace-row"><span>{invite.email} · {labels[invite.role]} · até {new Date(invite.expires_at).toLocaleDateString("pt-BR")}</span><Button variant="ghost" disabled={busy} onClick={() => void act(async () => { await workspaceApi("workspace/revoke", send({ invitationId: invite.id })); await load(); })}>Revogar convite</Button></div>)}
        <Button variant="outline" disabled={busy} onClick={() => void act(async () => { const result = await workspaceApi<{ events: AuditEvent[] }>("workspace/audit"); setEvents(result.events); setAudit(true); })}>Ver auditoria</Button>
        {audit && <section aria-label="Auditoria"><h3>Histórico de alterações</h3>{events.length === 0 && <p>Nenhuma alteração registrada.</p>}
          {events.map(event => <details key={event.id}><summary>{new Date(event.occurred_at).toLocaleString("pt-BR")} · {event.entity_type} · {event.operation} · {team?.members.find(m => m.user_id === event.actor_id)?.email || event.actor_id || "Migração"}</summary><p>Registro: {event.entity_id}</p><pre className="workspace-audit">{JSON.stringify({ antes: event.before_data, depois: event.after_data }, null, 2)}</pre></details>)}
          {events.length >= 50 && <Button variant="ghost" disabled={busy} onClick={() => void act(async () => { const result = await workspaceApi<{ events: AuditEvent[] }>(`workspace/audit?before=${events.at(-1)!.id}`); setEvents([...events, ...result.events]); })}>Carregar anteriores</Button>}
        </section>}
      </>}
    </Modal>}
  </>;
}
