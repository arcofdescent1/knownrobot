import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const acquisitionCookie="kr_acquisition";

export async function recordAcquisitionAccountEvent(service:SupabaseClient,eventType:"signup"|"first_value"|"maintainer_action"|"upstream_placement",accountId:string,resourceId?:string){
  try{
    const token=(await cookies()).get(acquisitionCookie)?.value;
    if(!token)return;
    const target=await service.from("acquisition_targets").select("id,status").eq("tracking_token",token).maybeSingle();
    if(!target.data)return;
    await service.from("acquisition_events").upsert({target_id:target.data.id,event_type:eventType,account_id:accountId,resource_id:resourceId||null},{onConflict:"target_id,event_type,account_id",ignoreDuplicates:true});
    if(eventType==="first_value"&&target.data.status!=="closed")await service.from("acquisition_targets").update({status:"activated",updated_at:new Date().toISOString()}).eq("id",target.data.id);
  }catch{/* Attribution must never block registration or contribution. */}
}
