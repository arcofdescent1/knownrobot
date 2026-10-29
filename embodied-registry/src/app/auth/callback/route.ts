import { NextRequest, NextResponse } from "next/server";
import { getSessionClient } from "@/lib/supabase/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const client = await getSessionClient();
  if (!code || !client) return NextResponse.redirect(new URL("/login?error=callback", request.url));
  const { error } = await client.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(error ? "/login?error=callback" : safeNext, request.url));
}
