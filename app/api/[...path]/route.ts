import { supabaseAuth } from "@/lib/auth-supabase";
import { professionalAuth, withIdentity, canWrite, scopeId } from "@/lib/workspace/context";
import { selectOrganization } from "@/lib/workspace/service";
import { workspaceHandler } from "@/lib/workspace/handlers";
import { NextRequest, NextResponse } from "next/server";
import { validToken, sameOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ path: string[] }> };

const failure = (error: string, status: number) =>
  NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );

async function handle(request: NextRequest, context: Context) {
  if (
    (process.env.VERCEL === "1" || process.env.CAMPO_STORAGE === "supabase") &&
    !professionalAuth() && !process.env.CAMPO_PASSWORD
  )
    return failure(
      "Defina CAMPO_PASSWORD para proteger o catálogo hospedado.",
      503,
    );
  if (!professionalAuth() && !validToken(request.cookies.get("campo-session")?.value))
    return failure("Sessão expirada. Entre novamente.", 401);
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    return failure("Origem não autorizada.", 403);

  if (process.env.VERCEL === "1" && process.env.CAMPO_STORAGE !== "supabase")
    return failure(
      "Esta versão do Campo usa SQLite e fotos em disco local, incompatíveis com a Vercel. Para usar a Vercel, é necessário configurar banco de dados e armazenamento de fotos externos. As chaves do Pl@ntNet e speciesLink não substituem esse armazenamento.",
      503,
    );

  try {
    if (professionalAuth()) {
      const auth = supabaseAuth(request);
      const { data: { user }, error } = await auth.client.auth.getUser();
      if (error || !user) return auth.apply(failure("Sessão expirada. Entre novamente.", 401));
      const result = await withIdentity({ userId: user.id }, async () => {
        const paths = (await context.params).path;
        // Workspace management remains available if the selected membership was removed.
        const selected = request.cookies.get("campo-organization")?.value;
        const { active: organization } = await selectOrganization(selected, paths[0] !== "workspace");
        return withIdentity({ userId: user.id, organizationId: organization.id, role: organization.role }, async () => {
          if (paths[0] === "workspace") {
            const boundAction = ["invite", "member", "revoke", "members", "audit"].includes(paths[1]);
            const expected = request.headers.get("X-Campo-Scope");
            if (boundAction && ((expected && expected !== scopeId()) || (request.method !== "GET" && !expected))) return failure("O espaço mudou. Reabra a gestão de equipe.", 409);
            return workspaceHandler(request, paths[1], user.email);
          }
          const expectedScope = request.headers.get("X-Campo-Scope");
          if ((expectedScope && expectedScope !== scopeId()) || (!["GET", "HEAD"].includes(request.method) && !expectedScope)) return failure("O espaço mudou. Reabra o catálogo ou selecione a organização original da coleta.", 409);
          const mutation = !["GET", "HEAD"].includes(request.method);
          // Export preview is read-only, but import/restore and all catalog mutations require a writer.
          if (mutation && !canWrite(organization.role)) return failure("Seu acesso permite apenas leitura.", 403);
          if (["projects", "campaigns"].includes(paths[0]) && mutation && !["owner", "admin"].includes(organization.role)) return failure("Apenas administradores podem gerenciar projetos e campanhas.", 403);
          if (paths[0] === "import" && mutation && !["owner", "admin"].includes(organization.role)) return failure("Apenas administradores podem importar ou restaurar dados.", 403);
          const handlers = await import("@/lib/server/api-handlers");
          return handlers[request.method as "GET" | "POST" | "PATCH" | "DELETE"](request, context);
        });
      });
      return auth.apply(result instanceof NextResponse ? result : new NextResponse(result.body, { status: result.status, headers: result.headers }));
    }
    if (process.env.CAMPO_STORAGE === "supabase") {
      // Block even stateless upload/provider endpoints if Auth was disabled against a professional database.
      const { requireCompatibleSchema } = await import("@/lib/db");
      await requireCompatibleSchema();
    }
    // Importar aqui permite responder JSON mesmo se o banco falhar ao iniciar.
    const handlers = await import("@/lib/server/api-handlers");
    return await handlers[
      request.method as "GET" | "POST" | "PATCH" | "DELETE"
    ](request, context);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") return failure("Dados inválidos. Revise os campos.", 400);
    if (error instanceof Error && error.message.startsWith("Acesso à organização")) return failure(error.message, 403);
    if (error && typeof error === "object" && "code" in error && error.code === "P0001") return failure("Operação não permitida. Revise o convite, a conta e as permissões. Mantenha ao menos um proprietário.", 400);
    // Não expor caminhos locais, credenciais ou detalhes internos na resposta.
    return failure(
      "Não foi possível iniciar o serviço de dados. Verifique a conexão do banco, as migrations e a configuração do armazenamento no servidor.",
      503,
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;

export const DELETE = handle;
