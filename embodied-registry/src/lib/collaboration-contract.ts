import { z } from "zod";
export const collectionSchema = z.object({ title:z.string().trim().min(2).max(160), slug:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{2,90}$/), description:z.string().trim().max(2000), organization_id:z.union([z.literal(""),z.uuid()]) });
export const collectionItemSchema = z.object({ collection_id:z.uuid(), target_type:z.enum(["artifact","evaluation","hardware","organization"]), target_id:z.uuid(), note:z.string().trim().max(1000) });
export const followSchema = z.object({ target_type:z.enum(["artifact","hardware","organization","collection"]), target_id:z.uuid(), operation:z.enum(["follow","unfollow"]) });
export const attemptSchema = z.object({ artifact_id:z.uuid(), evaluation_id:z.uuid(), relationship:z.enum(["direct","reproduction","derivative"]), notes:z.string().trim().max(2000) });
export const positionSchema = z.object({ attempt_id:z.uuid(), position:z.enum(["supports","disputes","needs_information"]), rationale:z.string().trim().min(20).max(2000), evidence_url:z.url().refine(v=>new URL(v).protocol==="https:"), supersedes_id:z.union([z.literal(""),z.uuid()]) });
export const relationSchema = z.object({ source_artifact_id:z.uuid(), target_artifact_id:z.uuid(), relation:z.enum(["derivative_of","reproduction_of"]), evidence_url:z.url().refine(v=>new URL(v).protocol==="https:") });
export type CollaborationState={ok:boolean;message:string;token?:string;href?:string};
export const initialCollaborationState:CollaborationState={ok:false,message:""};
