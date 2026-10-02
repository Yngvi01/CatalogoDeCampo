import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
export function supabaseAuth(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (process.env.CAMPO_STORAGE !== "supabase" || !url || !key)
    throw new Error("Configure CAMPO_STORAGE, SUPABASE_URL e SUPABASE_ANON_KEY para as contas profissionais.");
  const pending: { name: string; value: string; options: CookieOptions }[] = [];
  const client = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/" },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        for (const value of values) { request.cookies.set(value.name, value.value); pending.push(value); }
      },
    },
  });
  return {
    client,
    apply: (response: NextResponse) => {
      for (const value of pending) response.cookies.set(value.name, value.value, value.options);
      response.headers.set("Cache-Control", "no-store");
      return response;
    },
  };
}
