"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireIdentity } from "@/lib/supabase/session";
import {
  profileSchema,
  teamSchema,
  type IdentityActionState,
} from "@/lib/identity-contract";
const failure = (message: string): IdentityActionState => ({
  ok: false,
  message,
});

export async function saveProfile(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const { client, user } = await requireIdentity();
  if (form.get("public_consent") !== "on")
    return failure("Confirm that these profile details will be public.");
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return failure(parsed.error.issues[0].message);
  const existing = await client
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing.error)
    return failure("Profile service is temporarily unavailable.");
  const { error } = existing.data
    ? await client.from("profiles").update(parsed.data).eq("id", user.id)
    : await client.from("profiles").insert({ id: user.id, ...parsed.data });
  if (error)
    return failure(
      error.code === "23505"
        ? "That handle is already claimed. Choose another."
        : "Profile could not be saved. A claimed handle cannot be changed.",
    );
  revalidatePath("/account");
  revalidatePath(`/people/${parsed.data.handle}`);
  return { ok: true, message: "Public profile saved." };
}
export async function createTeam(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const { client } = await requireIdentity();
  if (form.get("public_consent") !== "on")
    return failure("Confirm that team details and membership will be public.");
  const parsed = teamSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return failure(parsed.error.issues[0].message);
  const { error } = await client.rpc("create_identity_team", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_description: parsed.data.description,
  });
  if (error)
    return failure(
      error.code === "23505"
        ? "That team slug is already claimed."
        : "Could not create team. Save your public profile first; each account can create up to 20 teams.",
    );
  revalidatePath("/account");
  return {
    ok: true,
    message:
      "Team created. You are its owner; this grants no evaluation verification authority.",
  };
}
export async function manageTeam(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const { client } = await requireIdentity();
  const parsed = z
    .object({
      operation: z.enum([
        "invite",
        "accept",
        "decline",
        "cancel",
        "remove",
        "transfer",
        "leave",
      ]),
      team_id: z.uuid(),
      handle: z.string().max(39).optional(),
      role: z.enum(["member", "admin"]).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return failure("Invalid team operation.");
  const { error } = await client.rpc("manage_identity_team", {
    p_operation: parsed.data.operation,
    p_team: parsed.data.team_id,
    p_handle: parsed.data.handle || null,
    p_role: parsed.data.role || "member",
  });
  if (error)
    return failure(
      "Team change was rejected. Check your role, the target handle, and whether the invitation is still valid. Owners must transfer ownership before leaving.",
    );
  revalidatePath("/account");
  return { ok: true, message: "Team updated." };
}
