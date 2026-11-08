import { z } from "zod";

const publicUrl = z.url().refine(value => new URL(value).protocol === "https:", "Use a public HTTPS source.");
export const reviewSubmissionSchema = z.object({ artifact_id:z.uuid(), field_name:z.enum(["title","summary","license","artifact_type","hardware","policy_family","calibration","evidence_status","other"]), decision:z.enum(["confirm","correct","uncertain"]), proposed_value:z.string().trim().min(2).max(2000), rationale:z.string().trim().min(20).max(2000), source_url:publicUrl });
export const clinicSubmissionSchema = z.object({ clinic_id:z.uuid(), artifact_url:z.url().refine(value => /^https:\/\/(github\.com|huggingface\.co)\//.test(value), "Use a public GitHub or Hugging Face URL."), problem:z.string().trim().min(20).max(2000), desired_outcome:z.string().trim().min(10).max(1000) });
export const bountySubmissionSchema = z.object({ bounty_id:z.uuid(), outcome:z.enum(["success","failure","blocked","unsafe"]), setup:z.string().trim().min(20).max(2000), observation:z.string().trim().min(20).max(4000), evidence_url:publicUrl });
export const distributionPlacementSchema=z.object({artifact_id:z.uuid(),placement_type:z.enum(["github_readme","huggingface_card","evidence_badge","compatibility_api","educator_resource","collection"]),placement_url:publicUrl.refine(value=>new URL(value).hostname!=="knownrobot.com","Register the external page where KnownRobot is embedded or cited.")});
export type OpportunityState={ok:boolean;message:string;href?:string;profileHref?:string;recommendedHref?:string;recommendedLabel?:string};
export const initialOpportunityState:OpportunityState={ok:false,message:""};
