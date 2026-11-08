import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { acquisitionCookie } from "@/lib/acquisition-attribution";

export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  if(!/^[A-Za-z0-9_-]{32,80}$/.test(token))return NextResponse.redirect(new URL("/opportunities",request.url));
  const service=getServiceSupabaseClient();
  if(!service)return NextResponse.redirect(new URL("/opportunities",request.url));
  const target=await service.from("acquisition_targets").select("id,action_path").eq("tracking_token",token).maybeSingle();
  if(!target.data)return NextResponse.redirect(new URL("/opportunities",request.url));
  const cookieHeader=request.headers.get("cookie")||"";
  const existing=cookieHeader.match(/(?:^|;\s*)kr_acquisition_session=([0-9a-f-]{36})/)?.[1];
  const sessionKey=existing||randomUUID();
  await service.from("acquisition_events").upsert({target_id:target.data.id,event_type:"qualified_visit",session_key:sessionKey},{onConflict:"target_id,event_type,session_key",ignoreDuplicates:true});
  const response=NextResponse.redirect(new URL(target.data.action_path,request.url));
  const options={httpOnly:true,sameSite:"lax" as const,secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30};
  response.cookies.set(acquisitionCookie,token,options);
  response.cookies.set("kr_acquisition_session",sessionKey,options);
  return response;
}
