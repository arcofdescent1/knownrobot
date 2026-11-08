"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { acquisitionTargetSchema,acquisitionTaskSchema,acquisitionUpdateSchema,type AcquisitionState } from "@/lib/acquisition-contract";
import { requireOperator } from "@/lib/operator-session";

const fail=(message:string):AcquisitionState=>({ok:false,message});
export async function createAcquisitionTarget(_:AcquisitionState,form:FormData):Promise<AcquisitionState>{try{
  const {service}=await requireOperator();const parsed=acquisitionTargetSchema.safeParse(Object.fromEntries(form));if(!parsed.success)return fail(parsed.error.issues[0].message);
  const artifact=await service.from("artifacts").select("id,slug,title").eq("id",parsed.data.artifact_id).single();if(artifact.error)return fail("Choose an existing public artifact.");
  const token=randomBytes(32).toString("base64url");const actionPath=`/opportunities/review/${artifact.data.slug}`;
  const saved=await service.from("acquisition_targets").insert({artifact_id:artifact.data.id,recipient_name:parsed.data.recipient_name,recipient_url:parsed.data.recipient_url,channel:parsed.data.channel,evidence_gap:parsed.data.evidence_gap,value_asset_summary:parsed.data.value_asset_summary,action_path:actionPath,tracking_token:token}).select("id").single();
  if(saved.error)return fail(saved.error.code==="23505"?"This artifact and recipient already have a campaign record.":"The campaign record could not be created.");
  const trackingUrl=`https://knownrobot.com/go/${token}`;
  const messageDraft=`Hi ${parsed.data.recipient_name} — I prepared a revision-pinned KnownRobot record for ${artifact.data.title}. ${parsed.data.value_asset_summary} The open question is: ${parsed.data.evidence_gap} Would you correct or confirm the draft? ${trackingUrl}`;
  revalidatePath("/operator/acquisition");return{ok:true,message:"Value asset and recipient-specific attribution link created.",trackingUrl,messageDraft};
}catch(error){return fail(error instanceof Error?error.message:"The campaign record could not be created.");}}

export async function updateAcquisitionTarget(_:AcquisitionState,form:FormData):Promise<AcquisitionState>{try{
  const{service}=await requireOperator();const parsed=acquisitionUpdateSchema.safeParse(Object.fromEntries(form));if(!parsed.success)return fail(parsed.error.issues[0].message);
  const now=new Date().toISOString();const update=parsed.data.operation==="contacted"?{status:"contacted",contacted_at:now,updated_at:now}:parsed.data.operation==="replied"?{status:"replied",replied_at:now,updated_at:now}:{status:"closed",updated_at:now};
  const saved=await service.from("acquisition_targets").update(update).eq("id",parsed.data.target_id).select("id").single();if(saved.error)return fail("Campaign state could not be updated.");
  if(parsed.data.operation==="replied")await service.from("acquisition_events").insert({target_id:parsed.data.target_id,event_type:"reply",session_key:randomBytes(16).toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*/,"$1-$2-$3-$4-$5")});
  revalidatePath("/operator/acquisition");return{ok:true,message:`Campaign marked ${parsed.data.operation}.`};
}catch(error){return fail(error instanceof Error?error.message:"Campaign state could not be updated.");}}

export async function completeAcquisitionTask(_:AcquisitionState,form:FormData):Promise<AcquisitionState>{try{
  const{user,service}=await requireOperator();const parsed=acquisitionTaskSchema.safeParse(Object.fromEntries(form));if(!parsed.success)return fail(parsed.error.issues[0].message);
  const saved=await service.from("acquisition_tasks").upsert({...parsed.data,updated_by:user.id,completed_at:new Date().toISOString()},{onConflict:"task_key"});if(saved.error)return fail("Proof could not be recorded.");
  revalidatePath("/operator/acquisition");return{ok:true,message:"Verified proof recorded."};
}catch(error){return fail(error instanceof Error?error.message:"Proof could not be recorded.");}}
