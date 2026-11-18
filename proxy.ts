import { professionalAuth } from "./lib/workspace/context";
import { supabaseAuth } from "./lib/auth-supabase";
import { NextRequest, NextResponse } from "next/server";
import { validToken, sameOrigin } from "./lib/auth";
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !sameOrigin(request)
  )
    return NextResponse.json(
      { error: "Origem não autorizada." },
      { status: 403 },
    );
  if (
    path === "/login" ||
    path === "/auth/callback" ||
    path === "/auth/recovery" ||
    path === "/api/auth" ||
    path === "/manifest.webmanifest" ||
    path === "/icon.svg" ||
    path === "/icon-192.png" ||
    path === "/icon-512.png" ||
    path === "/sw.js" ||
    path === "/collect.html" ||
    path === "/field-store.js" ||
    path === "/collect.js" ||
    path === "/offline.html"
  )
    return NextResponse.next();
  if (professionalAuth()) {
    try {
      const auth = supabaseAuth(request);
      const { data: { user }, error } = await auth.client.auth.getUser();
      const response = user && !error
        ? NextResponse.next({ request: { headers: request.headers } })
        : path.startsWith("/api/")
          ? NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 })
          : (() => { const login = new URL("/login", request.url); login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search); return NextResponse.redirect(login); })();
      return auth.apply(response);
    } catch {
      return NextResponse.json({ error: "Autenticação profissional indisponível. Verifique a configuração do Supabase." }, { status: 503 });
    }
  }
  if (validToken(request.cookies.get("campo-session")?.value))
    return NextResponse.next();
  if (path.startsWith("/api/"))
    return NextResponse.json(
      { error: "Acesso protegido. Entre novamente." },
      { status: 401 },
    );
  return NextResponse.redirect(new URL("/login", request.url));
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
