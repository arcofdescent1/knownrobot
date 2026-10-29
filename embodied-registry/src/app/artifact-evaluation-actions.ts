"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { guidedEvaluationSchema, buildGuidedEvaluation } from "@/lib/guided-evaluation-contract";
import { manifestIssues } from "@/lib/manifest-contract";
import { requireIdentity } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { notifyFollowers, recordActivity } from "@/lib/platform-service";
import type { IdentityActionState } from "@/lib/identity-contract";

const fail = (message: string): IdentityActionState => ({ ok: false, message });

export async function createAndAttachEvaluation(_: IdentityActionState, formData: FormData): Promise<IdentityActionState> {
  const { client, user } = await requireIdentity();
  if (formData.get("consent") !== "on") return fail("Confirm that these are actual results you have permission to publish.");
  const parsed = guidedEvaluationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 2000));
  const service = getServiceSupabaseClient();
  if (!service) return fail("Evaluation publishing is temporarily unavailable.");
  const [artifact, revision, profile] = await Promise.all([
    service.from("artifacts").select("id,slug,title,summary,source_url,source_provider").eq("id", parsed.data.artifact_id).maybeSingle(),
    service.from("artifact_revisions").select("source_revision").eq("artifact_id", parsed.data.artifact_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    service.from("profiles").select("display_name,handle").eq("id", user.id).maybeSingle(),
  ]);
  if (!artifact.data || !revision.data) return fail("The artifact or its pinned revision is unavailable.");
  let payload;
  try {
    payload = buildGuidedEvaluation(parsed.data, { ...artifact.data, source_revision: revision.data.source_revision }, profile.data || { display_name: null, handle: null });
  } catch (error) {
    return fail(error instanceof Error ? error.message.slice(0, 2000) : "The evaluation metadata is incomplete.");
  }
  const manifestErrors = manifestIssues(payload.manifest, true);
  if (manifestErrors.length) return fail(`Complete the reproducibility metadata: ${manifestErrors.join("; ")}`.slice(0, 2000));
  const saved = await client.rpc("submit_identity_evaluation", { p_id: parsed.data.submission_id, p_payload: payload, p_publish: true, p_consent: true });
  if (saved.error) return fail("The evaluation could not be published. Complete your contributor profile and check every pinned dependency and revision.");
  const successes = parsed.data.success_count;
  const outcome = successes === 0 ? "failure" : successes === parsed.data.trial_count ? "success" : "partial";
  const attached = await service.from("artifact_evaluation_attempts").upsert({ artifact_id: artifact.data.id, evaluation_id: saved.data, relationship: parsed.data.relationship, outcome, notes: parsed.data.runtime_notes, attached_by: user.id }, { onConflict: "artifact_id,evaluation_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (attached.error) return fail("The evaluation was published, but could not yet be attached. Return to Add evaluation and choose the published record.");
  await recordActivity(service, user.id, "attempt_attached", artifact.data.id, attached.data?.id || String(saved.data));
  await notifyFollowers(service, { artifact_id: artifact.data.id }, "evaluation_attempt", `${artifact.data.title} has a new ${outcome} attempt`, `${successes}/${parsed.data.trial_count} successful trials were published with provenance.`, `/artifacts/${artifact.data.slug}?tab=evidence`, user.id, attached.data?.id || String(saved.data));
  revalidatePath(`/artifacts/${artifact.data.slug}`);
  redirect(`/artifacts/${artifact.data.slug}?tab=evidence&added=evaluation#add-evidence`);
}
