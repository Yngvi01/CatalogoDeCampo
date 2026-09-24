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
    !process.env.CAMPO_PASSWORD
  )
    return failure(
      "Defina CAMPO_PASSWORD para proteger o catálogo hospedado.",
      503,
    );
  if (!validToken(request.cookies.get("campo-session")?.value))
    return failure("Sessão expirada. Entre novamente.", 401);
  if (!["GET", "HEAD"].includes(request.method) && !sameOrigin(request))
    return failure("Origem não autorizada.", 403);

  if (process.env.VERCEL === "1" && process.env.CAMPO_STORAGE !== "supabase")
    return failure(
      "Esta versão do Campo usa SQLite e fotos em disco local, incompatíveis com a Vercel. Para usar a Vercel, é necessário configurar banco de dados e armazenamento de fotos externos. As chaves do Pl@ntNet e speciesLink não substituem esse armazenamento.",
      503,
    );

  try {
    // Importar aqui permite responder JSON mesmo se o banco falhar ao iniciar.
    const handlers = await import("@/lib/server/api-handlers");
    return await handlers[request.method as "GET" | "POST" | "PATCH"](
      request,
      context,
    );
  } catch {
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
