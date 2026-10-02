import { professionalAuth } from "@/lib/workspace/context";
import { supabaseAuth } from "@/lib/auth-supabase";
import { z } from "zod";
import { limitedJson } from "@/lib/validation/body";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { token, sameOrigin } from "@/lib/auth";
const attempts = new Map<string, { count: number; until: number }>();
export async function GET() {
  return NextResponse.json({ professional: professionalAuth() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origem não autorizada." },
      { status: 403 },
    );
  if (professionalAuth()) {
    try {
      const input = z.object({ email: z.email().max(254), password: z.string().min(1).max(1000) }).parse(await limitedJson(request));
      const auth = supabaseAuth(request);
      const { error } = await auth.client.auth.signInWithPassword(input);
      const response = auth.apply(NextResponse.json(error ? { error: "E-mail ou senha inválidos, ou conta ainda não confirmada." } : { ok: true }, { status: error ? 401 : 200 }));
      if (!error) response.cookies.delete("campo-organization");
      return response;
    } catch {
      return NextResponse.json({ error: "Não foi possível entrar. Verifique os dados e a configuração do serviço." }, { status: 400 });
    }
  }
  const key = "login";
  const entry = attempts.get(key);
  if (entry && entry.until > Date.now() && entry.count >= 10)
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde 15 minutos." },
      { status: 429 },
    );
  let password: unknown;
  try {
    ({ password } = await limitedJson(request));
  } catch {
    return NextResponse.json(
      { error: "Requisição inválida." },
      { status: 400 },
    );
  }
  const expected = Buffer.from(process.env.CAMPO_PASSWORD || "");
  const provided = Buffer.from(
    typeof password === "string" ? password.slice(0, 1000) : "",
  );
  if (
    expected.length &&
    !(
      provided.length === expected.length && timingSafeEqual(provided, expected)
    )
  ) {
    attempts.set(key, {
      count: entry && entry.until > Date.now() ? entry.count + 1 : 1,
      until:
        entry && entry.until > Date.now() ? entry.until : Date.now() + 900000,
    });
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }
  attempts.delete(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set("campo-session", token(), {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 604800,
  });
  return response;
}
export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origem não autorizada." },
      { status: 403 },
    );
  if (professionalAuth()) {
    try {
      const auth = supabaseAuth(request);
      const { error } = await auth.client.auth.signOut();
      const response = auth.apply(NextResponse.json(error ? { error: "Não foi possível encerrar a sessão." } : { ok: true }, { status: error ? 503 : 200 }));
      response.cookies.delete("campo-organization");
      return response;
    } catch { return NextResponse.json({ error: "Autenticação indisponível." }, { status: 503 }); }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("campo-session");
  return response;
}
