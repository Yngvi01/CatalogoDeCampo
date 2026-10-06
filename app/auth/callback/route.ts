import { supabaseAuth } from "@/lib/auth-supabase";
import { safeReturnPath } from "@/lib/auth-redirect";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const destination = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    const login = new URL("/login?confirmation=error", request.url);
    return NextResponse.redirect(login);
  }

  try {
    const auth = supabaseAuth(request);
    const { error } = await auth.client.auth.exchangeCodeForSession(code);
    if (error) {
      const response = NextResponse.redirect(new URL("/login?confirmation=error", request.url));
      return auth.apply(response);
    }
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.delete("campo-organization");
    return auth.apply(response);
  } catch {
    return NextResponse.redirect(new URL("/login?confirmation=error", request.url));
  }
}
