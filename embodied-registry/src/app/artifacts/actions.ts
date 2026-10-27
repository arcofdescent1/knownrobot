"use server";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { importArtifactSchema, correctionSchema, type ArtifactActionState, type ArtifactSource } from "@/lib/artifact-contract";
import { fetchClaimProof, inspectArtifact } from "@/lib/artifact-importer";
import { requireIdentity } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

const fail = (message: string): ArtifactActionState => ({ ok: false, message });
const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72);
async function logActivity(service: NonNullable<ReturnType<typeof getServiceSupabaseClient>>, account: string, event: string, resource: string, dedupe: string) {
  await service.rpc("record_artifact_activity", { p_account: account, p_event: event, p_resource: resource, p_dedupe: dedupe });
}
async function actor() {
  const session = await requireIdentity();
  const profile = await session.client.from("profiles").select("id,handle").eq("id", session.user.id).maybeSingle();
  if (!profile.data?.handle) throw new Error("Complete your public profile before contributing artifacts.");
  const service = getServiceSupabaseClient();
  if (!service) throw new Error("Artifact service is unavailable.");
  return { ...session, profile: profile.data, service };
}

export async function importArtifact(_: ArtifactActionState, form: FormData): Promise<ArtifactActionState> {
  try {
    const { user, service } = await actor();
    const parsed = importArtifactSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const source = parsed.data.source_url;
    const inspection = await inspectArtifact(source, parsed.data.revision || undefined);
    const baseSlug = `${source.provider}-${slugify(source.repository)}`;
    const existing = await service.from("artifacts").select("id,slug").eq("source_provider", source.provider).eq("source_kind", source.kind).eq("source_repository", source.repository).maybeSingle();
    if (existing.error) throw existing.error;
    let artifact = existing.data;
    if (!artifact) {
      const inserted = await service.from("artifacts").insert({ slug: baseSlug, source_provider: source.provider, source_kind: source.kind, source_repository: source.repository, source_url: source.url, artifact_type: parsed.data.artifact_type, title: inspection.title, summary: inspection.summary, license: inspection.license, imported_by: user.id }).select("id,slug").single();
      if (inserted.error) throw inserted.error;
      artifact = inserted.data;
    }
    const prior = await service.from("artifact_revisions").select("id").eq("artifact_id", artifact.id).eq("source_revision", inspection.revision).maybeSingle();
    let revision = prior.data;
    if (!revision) {
      const inserted = await service.from("artifact_revisions").insert({ artifact_id: artifact.id, source_revision: inspection.revision, source_revision_url: inspection.revisionUrl, metadata: inspection.metadata, inspected_files: inspection.inspectedFiles, uncertainties: inspection.uncertainties, imported_by: user.id }).select("id").single();
      if (inserted.error) throw inserted.error;
      revision = inserted.data;
      await service.from("artifacts").update({ latest_revision_id: revision.id, updated_at: new Date().toISOString() }).eq("id", artifact.id);
      await service.from("artifact_contributions").insert({ artifact_id: artifact.id, revision_id: revision.id, contributor_profile_id: user.id, kind: "import", summary: `Imported and inspected revision ${inspection.revision.slice(0, 12)}.`, payload: { source_revision: inspection.revision, inspection_boundary: "approved metadata files only" }, evidence_url: inspection.revisionUrl });
      await logActivity(service, user.id, "artifact_imported", artifact.id, revision.id);
    }
    revalidatePath("/artifacts"); revalidatePath(`/artifacts/${artifact.slug}`); revalidatePath("/account");
    return { ok: true, message: prior.data ? "This pinned revision was already imported; its canonical record is unchanged." : "Canonical artifact and pinned metadata revision published.", href: `/artifacts/${artifact.slug}` };
  } catch (error) { return fail(error instanceof Error ? error.message : "Artifact import failed."); }
}

export async function requestArtifactClaim(_: ArtifactActionState, form: FormData): Promise<ArtifactActionState> {
  try {
    const { user, profile, service } = await actor();
    const artifactId = String(form.get("artifact_id") || "");
    const organizationId = String(form.get("organization_id") || "");
    let claimant: { profile?: string; organization?: string; label: string } = { profile: user.id, label: `people/${profile.handle}` };
    if (organizationId) {
      const membership = await service.from("organization_members").select("role,organizations(slug)").eq("organization_id", organizationId).eq("profile_id", user.id).in("role", ["owner", "admin"]).maybeSingle();
      const org = Array.isArray(membership.data?.organizations) ? membership.data.organizations[0] : membership.data?.organizations;
      if (!org) return fail("Only a team owner or admin can request its claim.");
      claimant = { organization: organizationId, label: `teams/${org.slug}` };
    }
    const artifact = await service.from("artifacts").select("id,slug").eq("id", artifactId).maybeSingle();
    if (!artifact.data) return fail("Artifact not found.");
    const token = `kr_claim_${randomBytes(24).toString("base64url")}`;
    const content = JSON.stringify({ knownrobot_claim: token, artifact: artifact.data.slug, claimant: claimant.label }, null, 2);
    const challenge = await service.from("artifact_claim_challenges").insert({ artifact_id: artifactId, requested_by: user.id, claimant_profile_id: claimant.profile || null, claimant_organization_id: claimant.organization || null, token_hash: createHash("sha256").update(token).digest("hex"), expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }).select("id").single();
    if (challenge.error) throw challenge.error;
    return { ok: true, message: "Commit this exact file to the repository's default branch, then verify within seven days.", challenge: { id: challenge.data.id, token, path: ".knownrobot/claim.json", content } };
  } catch (error) { return fail(error instanceof Error ? error.message : "Could not create claim challenge."); }
}

export async function verifyArtifactClaim(_: ArtifactActionState, form: FormData): Promise<ArtifactActionState> {
  try {
    const { user, service } = await actor();
    const challengeId = String(form.get("challenge_id") || "");
    const token = String(form.get("token") || "");
    const challenge = await service.from("artifact_claim_challenges").select("*,artifacts(id,slug,source_provider,source_kind,source_repository,source_url)").eq("id", challengeId).eq("requested_by", user.id).maybeSingle();
    if (!challenge.data || challenge.data.consumed_at || new Date(challenge.data.expires_at) <= new Date()) return fail("That claim challenge is invalid or expired.");
    if (createHash("sha256").update(token).digest("hex") !== challenge.data.token_hash) return fail("The claim token does not match.");
    const a = Array.isArray(challenge.data.artifacts) ? challenge.data.artifacts[0] : challenge.data.artifacts;
    const source: ArtifactSource = { provider: a.source_provider, kind: a.source_kind, repository: a.source_repository, url: a.source_url };
    const proof = await fetchClaimProof(source, ".knownrobot/claim.json");
    let label: string;
    if (challenge.data.claimant_profile_id) {
      const expected = await service.from("profiles").select("handle").eq("id", challenge.data.claimant_profile_id).single();
      label = `people/${expected.data?.handle}`;
    } else {
      const expected = await service.from("organizations").select("slug").eq("id", challenge.data.claimant_organization_id).single();
      label = `teams/${expected.data?.slug}`;
    }
    const parsed = JSON.parse(proof.text);
    if (parsed.knownrobot_claim !== token || parsed.artifact !== a.slug || parsed.claimant !== label) return fail("The committed claim file does not exactly match this challenge.");
    const claim = await service.from("artifact_claims").insert({ artifact_id: a.id, claimant_profile_id: challenge.data.claimant_profile_id, claimant_organization_id: challenge.data.claimant_organization_id, verified_by: user.id, proof_provider: source.provider, proof_url: proof.proofUrl, proof_revision: proof.revision, proof_digest: proof.digest }).select("id").single();
    if (claim.error) return fail(claim.error.code === "23505" ? "This artifact has already been claimed." : "The verified claim could not be recorded.");
    await service.from("artifacts").update({ owner_profile_id: challenge.data.claimant_profile_id, owner_organization_id: challenge.data.claimant_organization_id, updated_at: new Date().toISOString() }).eq("id", a.id);
    await service.from("artifact_contributions").insert({ artifact_id: a.id, contributor_profile_id: user.id, contributor_organization_id: challenge.data.claimant_organization_id, kind: "claim", summary: "Verified upstream maintainership through a repository-backed challenge.", payload: { proof_revision: proof.revision, proof_digest: proof.digest }, evidence_url: proof.proofUrl });
    await service.from("artifact_claim_challenges").update({ consumed_at: new Date().toISOString() }).eq("id", challengeId);
    await logActivity(service, user.id, "artifact_claimed", a.id, claim.data.id);
    revalidatePath(`/artifacts/${a.slug}`); revalidatePath("/account");
    return { ok: true, message: "Maintainer ownership verified. You can now publish attributable corrections without moving the artifact." };
  } catch (error) { return fail(error instanceof Error ? error.message : "Claim verification failed."); }
}

export async function correctArtifact(_: ArtifactActionState, form: FormData): Promise<ArtifactActionState> {
  try {
    const { user, service } = await actor();
    const parsed = correctionSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0].message);
    const artifact = await service.from("artifacts").select("*,artifact_claims(claimant_profile_id,claimant_organization_id)").eq("id", parsed.data.artifact_id).single();
    if (artifact.error) throw artifact.error;
    const claim = Array.isArray(artifact.data.artifact_claims) ? artifact.data.artifact_claims[0] : artifact.data.artifact_claims;
    let authorized = claim?.claimant_profile_id === user.id;
    if (!authorized && claim?.claimant_organization_id) {
      const member = await service.from("organization_members").select("role").eq("organization_id", claim.claimant_organization_id).eq("profile_id", user.id).in("role", ["owner", "admin"]).maybeSingle();
      authorized = Boolean(member.data);
    }
    if (!authorized) return fail("Only the verified maintainer or a claimed team's owner/admin can correct this record.");
    const before = { title: artifact.data.title, summary: artifact.data.summary, license: artifact.data.license };
    const after = { title: parsed.data.title, summary: parsed.data.summary, license: parsed.data.license };
    const update = await service.from("artifacts").update({ ...after, updated_at: new Date().toISOString() }).eq("id", parsed.data.artifact_id);
    if (update.error) throw update.error;
    const contribution = await service.from("artifact_contributions").insert({ artifact_id: parsed.data.artifact_id, contributor_profile_id: user.id, contributor_organization_id: claim.claimant_organization_id, kind: "correction", summary: parsed.data.explanation, payload: { before, after }, evidence_url: parsed.data.evidence_url || null }).select("id").single();
    await logActivity(service, user.id, "artifact_corrected", parsed.data.artifact_id, contribution.data?.id || crypto.randomUUID());
    revalidatePath(`/artifacts/${artifact.data.slug}`); revalidatePath("/account");
    return { ok: true, message: "Correction published with an attributable, append-only change record." };
  } catch (error) { return fail(error instanceof Error ? error.message : "Correction failed."); }
}
