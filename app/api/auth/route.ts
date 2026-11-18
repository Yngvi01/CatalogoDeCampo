import { professionalAuth } from "@/lib/workspace/context";
import { supabaseAuth } from "@/lib/auth-supabase";
import { z } from "zod";
import { limitedJson } from "@/lib/validation/body";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { token, sameOrigin } from "@/lib/auth";
import { safeReturnPath } from "@/lib/auth-redirect";
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
      const input = z.object({
        action: z.enum(["login", "signup", "resend", "recover", "updatePassword"]).default("login"),
        email: z.email().max(254).optional(),
        password: z.string().min(1).max(1000).optional(),
        next: z.unknown().optional(),
      }).parse(await limitedJson(request));
      const auth = supabaseAuth(request);
      const emailCallback = (next: string) => {
        const target = new URL("/auth/callback", request.nextUrl.origin);
        target.searchParams.set("next", next);
        return target.toString();
      };
      const email = input.email;
      if (input.action === "updatePassword") {
        if (!input.password || input.password.length < 12)
          return NextResponse.json({ error: "A senha precisa ter pelo menos 12 caracteres." }, { status: 400 });
        const { error } = await auth.client.auth.updateUser({ password: input.password });
        if (error)
          return auth.apply(NextResponse.json({ error: "Não foi possível alterar a senha. Solicite outro link de recuperação." }, { status: 400 }));
        return auth.apply(NextResponse.json({ ok: true }));
      }
      if (!email)
        return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
      if (input.action === "recover") {
        const { error } = await auth.client.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("/auth/recovery", request.nextUrl.origin).toString(),
        });
        if (error) {
          const detail = error.message.toLowerCase();
          const message = detail.includes("redirect") || detail.includes("url")
            ? "O Supabase recusou o endereço de retorno. Adicione https://catalogo-de-campo.vercel.app/auth/recovery às Redirect URLs do projeto."
            : /rate|too many|after .*second|after .*minute/.test(detail)
              ? "Já houve uma solicitação recente. Aguarde um minuto antes de pedir outro link."
              : "Não foi possível solicitar a recuperação. Tente novamente mais tarde.";
          return auth.apply(NextResponse.json({ error: message }, { status: 400 }));
        }
        return auth.apply(NextResponse.json({ ok: true }));
      }
      if (input.action === "resend") {
        const { error } = await auth.client.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: emailCallback(safeReturnPath(input.next)) },
        });
        if (error)
          return auth.apply(NextResponse.json({ error: "Não foi possível reenviar a confirmação. Tente recuperar a senha se esta conta já existir." }, { status: 400 }));
        return auth.apply(NextResponse.json({ ok: true }));
      }
      const password = input.password;
      if (!password)
        return NextResponse.json({ error: "Informe a senha." }, { status: 400 });
      if (input.action === "signup") {
        if (password.length < 12)
          return NextResponse.json({ error: "A senha precisa ter pelo menos 12 caracteres." }, { status: 400 });
        const { data, error } = await auth.client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: emailCallback(safeReturnPath(input.next)) },
        });
        if (error)
          return auth.apply(NextResponse.json({ error: "Não foi possível criar a conta. Confira os dados e tente novamente." }, { status: 400 }));
        const response = NextResponse.json({ ok: true, confirmationRequired: !data.session });
        response.cookies.delete("campo-organization");
        return auth.apply(response);
      }
      const { error } = await auth.client.auth.signInWithPassword({ email, password });
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
