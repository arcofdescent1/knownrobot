import "server-only";
import { getPublicSupabaseClient } from "./supabase/server";

export async function listOpportunities(){
  const client=getPublicSupabaseClient();
  if(!client) return {clinics:[],bounties:[],reviews:[]};
  const [clinics,bounties,reviews]=await Promise.all([
    client.from("compatibility_clinics").select("*,clinic_submissions(count)").in("status",["open","full"]).order("starts_at"),
    client.from("evidence_bounties").select("*,artifacts(slug,title,artifact_type),evidence_bounty_submissions(count)").eq("status","open").order("updated_at",{ascending:false}),
    client.from("artifacts").select("id,slug,title,summary,artifact_type,source_repository,source_url,license,artifact_revisions(source_revision,uncertainties,created_at),artifact_claims(id),artifact_review_submissions(count),artifact_contributions(kind,payload),artifact_evaluation_attempts(relationship),artifact_distribution_placements(id)").order("updated_at",{ascending:false}).limit(25),
  ]);
  if(clinics.error||bounties.error||reviews.error) {
    console.error("Contributor opportunity query failed", {
      clinics: clinics.error && {code:clinics.error.code,message:clinics.error.message,details:clinics.error.details,hint:clinics.error.hint},
      bounties: bounties.error && {code:bounties.error.code,message:bounties.error.message,details:bounties.error.details,hint:bounties.error.hint},
      reviews: reviews.error && {code:reviews.error.code,message:reviews.error.message,details:reviews.error.details,hint:reviews.error.hint},
    });
    throw new Error("Contributor opportunities are temporarily unavailable.");
  }
  return {clinics:clinics.data||[],bounties:bounties.data||[],reviews:(reviews.data||[]).filter(row=>!row.artifact_claims?.length)};
}

export async function readBounty(slug:string){
  const client=getPublicSupabaseClient(); if(!client) return null;
  const result=await client.from("evidence_bounties").select("*,artifacts(id,slug,title,summary,source_url,source_repository),evidence_bounty_submissions(*,profiles(handle,display_name))").eq("slug",slug).maybeSingle();
  if(result.error) throw new Error("Evidence request is temporarily unavailable."); return result.data;
}

export async function readClinic(slug:string){
  const client=getPublicSupabaseClient(); if(!client) return null;
  const result=await client.from("compatibility_clinics").select("*,clinic_submissions(count)").eq("slug",slug).maybeSingle();
  if(result.error) throw new Error("Clinic details are temporarily unavailable."); return result.data;
}
