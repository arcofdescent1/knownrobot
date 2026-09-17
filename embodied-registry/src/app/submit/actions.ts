"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/supabase/session";
import { manifestIssues } from "@/lib/manifest-contract";
import {
  submissionSchema,
  type IdentityActionState,
} from "@/lib/identity-contract";

export async function submitEvaluation(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const { client } = await requireIdentity();
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
  redirect(mode === "publish" ? `/evaluations/${data}` : "/account");
}
export async function publishDraft(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const { client } = await requireIdentity();
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
  redirect(`/evaluations/${id.data}`);
}
