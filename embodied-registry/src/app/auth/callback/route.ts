import { NextRequest, NextResponse } from "next/server";
import { getSessionClient } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { recordAcquisitionAccountEvent } from "@/lib/acquisition-attribution";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const client = await getSessionClient();
  if (!code || !client) return NextResponse.redirect(new URL("/login?error=callback", request.url));
  const { data, error } = await client.auth.exchangeCodeForSession(code);
  const service=getServiceSupabaseClient();
  if(!error&&data.user&&service)await recordAcquisitionAccountEvent(service,"signup",data.user.id);
  return NextResponse.redirect(new URL(error ? "/login?error=callback" : safeNext, request.url));
}
