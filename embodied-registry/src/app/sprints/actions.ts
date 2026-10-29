"use server";

import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";
import { sprintApplicationSchema, type SprintApplicationState } from "@/lib/sprint-application-contract";

const fail = (message: string): SprintApplicationState => ({ ok: false, message });

export async function submitSprintApplication(_: SprintApplicationState, form: FormData): Promise<SprintApplicationState> {
  try {
    const { user, client } = await requireIdentity();
    const profile = await client.from("profiles").select("handle").eq("id", user.id).maybeSingle();
    if (!profile.data?.handle) return fail("Complete your public contributor profile before applying.");
    const parsed = sprintApplicationSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message || "Review the application fields.");
    const service = getServiceSupabaseClient();
    if (!service) return fail("Sprint applications are temporarily unavailable.");
    const saved = await service.from("sprint_applications").upsert({
      sprint_id: parsed.data.sprint_id,
      applicant_id: user.id,
      role: parsed.data.role,
      team_name: parsed.data.team_name,
      environment: parsed.data.environment,
      configuration: parsed.data.configuration,
      evidence_url: parsed.data.evidence_url || null,
      availability: parsed.data.availability,
      attribution_consent: true,
      status: "submitted",
      updated_at: new Date().toISOString(),
    }, { onConflict: "sprint_id,applicant_id" });
    if (saved.error) throw saved.error;
    revalidatePath("/sprints");
    return { ok: true, message: "Application received. It is not a public commitment yet; KnownRobot will review readiness and coordinate the next step with you." };
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Application could not be submitted.");
  }
}

