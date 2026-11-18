import { supabaseAuth } from "@/lib/auth-supabase";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code)
    return NextResponse.redirect(new URL("/login?recovery=error", request.url));

  try {
    const auth = supabaseAuth(request);
    const { error } = await auth.client.auth.exchangeCodeForSession(code);
    if (error)
      return auth.apply(NextResponse.redirect(new URL("/login?recovery=error", request.url)));
    return auth.apply(NextResponse.redirect(new URL("/login?recovery=1", request.url)));
  } catch {
    return NextResponse.redirect(new URL("/login?recovery=error", request.url));
  }
}
