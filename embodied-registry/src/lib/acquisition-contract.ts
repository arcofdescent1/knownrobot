import { z } from "zod";

export const acquisitionTargetSchema=z.object({
  artifact_id:z.string().uuid(),
  recipient_name:z.string().trim().min(2).max(160),
  recipient_url:z.string().url().refine(value=>value.startsWith("https://"),"Use a public HTTPS recipient URL."),
  channel:z.enum(["github","huggingface","email","reddit","discord","forum","community","partner"]),
  evidence_gap:z.string().trim().min(20).max(2000),
  value_asset_summary:z.string().trim().min(20).max(4000),
});

export const acquisitionUpdateSchema=z.object({
  target_id:z.string().uuid(),
  operation:z.enum(["contacted","replied","closed"]),
});

export const acquisitionTaskSchema=z.object({
  task_key:z.enum(["correction_flow_verified","evidence_bounty_posted"]),
  proof_url:z.string().url().refine(value=>value.startsWith("https://"),"Use a public HTTPS proof URL."),
});

export type AcquisitionState={ok:boolean;message:string;trackingUrl?:string;messageDraft?:string};
