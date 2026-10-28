import "server-only";
import { cache } from "react";
import { getPublicSupabaseClient } from "./supabase/server";

export const listArtifacts = cache(async () => {
  const client = getPublicSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("artifacts").select("id,slug,title,summary,artifact_type,source_provider,source_kind,source_repository,updated_at,owner_profile_id,owner_organization_id").order("updated_at", { ascending: false }).limit(100);
  if (error) throw new Error("Artifacts are temporarily unavailable.");
  return data || [];
});

export const readArtifact = cache(async (slug: string) => {
  const client = getPublicSupabaseClient();
  if (!client) throw new Error("Artifacts are unavailable.");
  const artifact = await client.from("artifacts").select("*,profiles!artifacts_owner_profile_id_fkey(handle,display_name),organizations!artifacts_owner_organization_id_fkey(slug,name),publisher:assessment_assessors!artifacts_imported_by_publisher_id_fkey(handle,display_name)").eq("slug", slug).maybeSingle();
  if (artifact.error) throw new Error("Artifact is temporarily unavailable.");
  if (!artifact.data) return null;
  const [revisions, claims, contributions, attempts, relations] = await Promise.all([
    client.from("artifact_revisions").select("id,source_revision,source_revision_url,inspected_files,uncertainties,created_at").eq("artifact_id", artifact.data.id).order("created_at", { ascending: false }),
    client.from("artifact_claims").select("id,claimant_profile_id,claimant_organization_id,proof_url,proof_revision,verified_at").eq("artifact_id", artifact.data.id),
    client.from("artifact_contributions").select("id,kind,summary,payload,evidence_url,created_at,profiles(handle,display_name),organizations(slug,name),publisher:assessment_assessors!artifact_contributions_contributor_publisher_id_fkey(handle,display_name)").eq("artifact_id", artifact.data.id).order("created_at", { ascending: false }).limit(100),
    client.from("artifact_evaluation_attempts").select("id,relationship,outcome,notes,created_at,evaluations(id,trial_count,success_count,success_rate,verification_status,record_version,skills(name),hardware_profiles(robot_family,configuration),benchmarks(name,version),verification_reviews(id,new_status,rationale,evidence_url,created_at),evidence_positions(id,reviewer_id,position,rationale,evidence_url,supersedes_id,created_at,profiles(handle,display_name)))").eq("artifact_id",artifact.data.id).order("created_at",{ascending:false}),
    client.from("artifact_relations").select("id,source_artifact_id,target_artifact_id,relation,evidence_url,created_at,source:artifacts!artifact_relations_source_artifact_id_fkey(slug,title),target:artifacts!artifact_relations_target_artifact_id_fkey(slug,title)").or(`source_artifact_id.eq.${artifact.data.id},target_artifact_id.eq.${artifact.data.id}`).order("created_at",{ascending:false}),
  ]);
  if (revisions.error || claims.error || contributions.error || attempts.error || relations.error) throw new Error("Artifact history is temporarily unavailable.");
  return { artifact: artifact.data, revisions: revisions.data || [], claims: claims.data || [], contributions: contributions.data || [], attempts:attempts.data||[], relations:relations.data||[] };
});
