import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ArtifactSource } from "./artifact-contract";
import { inspectArtifact } from "./artifact-importer";

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
export async function recordActivity(service: SupabaseClient, account: string, event: string, resource: string, dedupe: string) {
  const fn = event.startsWith("artifact_") && event !== "artifact_followed" ? "record_artifact_activity" : "record_collaboration_activity";
  await service.rpc(fn, { p_account: account, p_event: event, p_resource: resource, p_dedupe: dedupe });
}
export async function notifyFollowers(service: SupabaseClient, target: { artifact_id?: string; hardware_profile_id?: string; organization_id?: string; collection_id?: string }, eventType: string, title: string, body: string, href: string, actor: string, resourceKey: string) {
  const [column, value] = Object.entries(target)[0];
  const followers = await service.from("follows").select("follower_id").eq(column, value);
  const rows = (followers.data || []).filter(row => row.follower_id !== actor).map(row => ({ recipient_id: row.follower_id, event_type: eventType, title, body, href, actor_id: actor, resource_key: resourceKey }));
  if (rows.length) await service.from("notifications").upsert(rows, { onConflict: "recipient_id,event_type,resource_key", ignoreDuplicates: true });
}
export async function persistArtifactImport(service: SupabaseClient, userId: string, source: ArtifactSource, artifactType: string, requestedRevision?: string) {
  const inspection = await inspectArtifact(source, requestedRevision);
  const existing = await service.from("artifacts").select("id,slug").eq("source_provider", source.provider).eq("source_kind", source.kind).eq("source_repository", source.repository).maybeSingle();
  if (existing.error) throw existing.error;
  let artifact = existing.data;
  if (!artifact) {
    const inserted = await service.from("artifacts").insert({ slug: `${source.provider}-${slugify(source.repository)}`, source_provider: source.provider, source_kind: source.kind, source_repository: source.repository, source_url: source.url, artifact_type: artifactType, title: inspection.title, summary: inspection.summary, license: inspection.license, imported_by: userId }).select("id,slug").single();
    if (inserted.error) throw inserted.error;
    artifact = inserted.data;
  }
  const prior = await service.from("artifact_revisions").select("id").eq("artifact_id", artifact.id).eq("source_revision", inspection.revision).maybeSingle();
  let revision = prior.data;
  if (!revision) {
    const inserted = await service.from("artifact_revisions").insert({ artifact_id: artifact.id, source_revision: inspection.revision, source_revision_url: inspection.revisionUrl, metadata: inspection.metadata, inspected_files: inspection.inspectedFiles, uncertainties: inspection.uncertainties, imported_by: userId }).select("id").single();
    if (inserted.error) throw inserted.error;
    revision = inserted.data;
    await service.from("artifacts").update({ latest_revision_id: revision.id, updated_at: new Date().toISOString() }).eq("id", artifact.id);
    await service.from("artifact_contributions").insert({ artifact_id: artifact.id, revision_id: revision.id, contributor_profile_id: userId, kind: "import", summary: `Imported and inspected revision ${inspection.revision.slice(0, 12)}.`, payload: { source_revision: inspection.revision, inspection_boundary: "approved metadata files only" }, evidence_url: inspection.revisionUrl });
    await recordActivity(service, userId, "artifact_imported", artifact.id, revision.id);
    await notifyFollowers(service, { artifact_id: artifact.id }, "artifact_revision", `${inspection.title} has a new pinned revision`, `KnownRobot inspected approved metadata at ${inspection.revision.slice(0, 12)}.`, `/artifacts/${artifact.slug}`, userId, revision.id);
  }
  return { artifact, revision, existed: Boolean(prior.data), inspection };
}
export async function authenticateApiToken(service: SupabaseClient, authorization: string | null) {
  const token = authorization?.match(/^Bearer (kr_[A-Za-z0-9_-]{32,})$/)?.[1];
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const record = await service.from("api_tokens").select("id,owner_id,expires_at,revoked_at").eq("token_hash", hash).maybeSingle();
  if (!record.data || record.data.revoked_at || new Date(record.data.expires_at) <= new Date()) return null;
  await service.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", record.data.id);
  return record.data;
}
