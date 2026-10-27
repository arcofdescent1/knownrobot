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
  const artifact = await client.from("artifacts").select("*,profiles!artifacts_owner_profile_id_fkey(handle,display_name),organizations!artifacts_owner_organization_id_fkey(slug,name)").eq("slug", slug).maybeSingle();
  if (artifact.error) throw new Error("Artifact is temporarily unavailable.");
  if (!artifact.data) return null;
  const [revisions, claims, contributions] = await Promise.all([
    client.from("artifact_revisions").select("id,source_revision,source_revision_url,inspected_files,uncertainties,created_at").eq("artifact_id", artifact.data.id).order("created_at", { ascending: false }),
    client.from("artifact_claims").select("id,claimant_profile_id,claimant_organization_id,proof_url,proof_revision,verified_at").eq("artifact_id", artifact.data.id),
    client.from("artifact_contributions").select("id,kind,summary,payload,evidence_url,created_at,profiles(handle,display_name),organizations(slug,name)").eq("artifact_id", artifact.data.id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (revisions.error || claims.error || contributions.error) throw new Error("Artifact history is temporarily unavailable.");
  return { artifact: artifact.data, revisions: revisions.data || [], claims: claims.data || [], contributions: contributions.data || [] };
});
