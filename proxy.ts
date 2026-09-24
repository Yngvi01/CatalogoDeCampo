import { NextRequest, NextResponse } from "next/server";
import { validToken, sameOrigin } from "./lib/auth";
export function proxy(request: NextRequest) {
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
    path === "/api/auth" ||
    path === "/manifest.webmanifest" ||
    path === "/icon.svg" ||
    path === "/icon-192.png" ||
    path === "/icon-512.png" ||
    path === "/sw.js" ||
    path === "/offline.html"
  )
    return NextResponse.next();
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
