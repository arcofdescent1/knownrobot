"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/supabase/session";
import { manifestIssues } from "@/lib/manifest-contract";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { notifyFollowers } from "@/lib/platform-service";
import {
  submissionSchema,
  type IdentityActionState,
} from "@/lib/identity-contract";

export async function submitEvaluation(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const { client, user } = await requireIdentity();
  if (form.get("consent") !== "on")
    return {
      ok: false,
      message:
        "Confirm that you have permission to share the artifacts and attribute this evaluation to your profile.",
    };
  let payload: unknown;
  try {
    const text = String(form.get("payload") || "");
    if (text.length > 100000) throw new Error();
    payload = JSON.parse(text);
  } catch {
    return { ok: false, message: "Supply valid JSON smaller than 100 KB." };
  }
  const parsed = submissionSchema.safeParse(payload);
  const id = z.uuid().safeParse(form.get("submission_id"));
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")
        .slice(0, 2000),
    };
  if (!id.success)
    return { ok: false, message: "Submission ID is invalid. Reload the form." };
  const mode = form.get("mode");
  if (mode !== "draft" && mode !== "publish")
    return { ok: false, message: "Choose draft or public publication." };
  if (mode === "publish") {
    const issues = manifestIssues(parsed.data.manifest, true);
    if (issues.length) return { ok: false, message: `Save as a draft or supply complete metadata: ${issues.join("; ")}`.slice(0, 2000) };
  }
  const { data, error } = await client.rpc("submit_identity_evaluation", {
    p_id: id.data,
    p_payload: parsed.data,
    p_publish: mode === "publish",
    p_consent: true,
  });
  if (error)
    return {
      ok: false,
      message:
        "Could not save this evaluation. Check your public profile, team membership, artifact metadata and whether this submission ID was already used.",
    };
  if (mode === "publish") {
    const service = getServiceSupabaseClient();
    if (service) {
      const evaluation = await service.from("evaluations").select("hardware_profile_id,skills(owner_organization_id,name)").eq("id", data).single();
      const skill = Array.isArray(evaluation.data?.skills) ? evaluation.data.skills[0] : evaluation.data?.skills;
      await notifyFollowers(service, { hardware_profile_id: evaluation.data!.hardware_profile_id }, "evaluation_attempt", `${parsed.data.robot_family} has new evaluation evidence`, `${parsed.data.name} published ${parsed.data.success_count}/${parsed.data.trial_count} successful trials.`, `/evaluations/${data}`, user.id, data);
      if (skill?.owner_organization_id) await notifyFollowers(service, { organization_id: skill.owner_organization_id }, "organization_update", `${skill.name} has new evaluation evidence`, "A team-owned policy received a published evaluation.", `/evaluations/${data}`, user.id, data);
    }
  }
  redirect(mode === "publish" ? `/evaluations/${data}` : "/account");
}
export async function publishDraft(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const { client, user } = await requireIdentity();
  if (form.get("consent") !== "on")
    return {
      ok: false,
      message: "Confirm public publication and attribution.",
    };
  const id = z.uuid().safeParse(form.get("draft_id"));
  if (!id.success) return { ok: false, message: "Invalid draft ID." };
  const { error } = await client.rpc("publish_identity_draft", {
    p_id: id.data,
  });
  if (error)
    return {
      ok: false,
      message:
        error.code === "22023" ? "Draft metadata is incomplete or inconsistent. Save a corrected revision with a complete portable manifest before publishing." : "Draft could not be published. Only its submitter can publish, and current artifact ownership or team membership is required.",
    };
  const service = getServiceSupabaseClient();
  if (service) {
    const evaluation = await service.from("evaluations").select("hardware_profile_id,skills(owner_organization_id,name)").eq("id", id.data).single();
    const skill = Array.isArray(evaluation.data?.skills) ? evaluation.data.skills[0] : evaluation.data?.skills;
    await notifyFollowers(service, { hardware_profile_id: evaluation.data!.hardware_profile_id }, "evaluation_attempt", `${skill?.name || "Policy"} has new evaluation evidence`, "A private draft was published as attributable evidence.", `/evaluations/${id.data}`, user.id, id.data);
    if (skill?.owner_organization_id) await notifyFollowers(service, { organization_id: skill.owner_organization_id }, "organization_update", `${skill.name} has new evaluation evidence`, "A team-owned policy received a published evaluation.", `/evaluations/${id.data}`, user.id, id.data);
  }
  redirect(`/evaluations/${id.data}`);
}
