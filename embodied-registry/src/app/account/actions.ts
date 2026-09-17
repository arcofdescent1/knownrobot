"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  emailAuthReady,
  getSessionClient,
  requireIdentity,
} from "@/lib/supabase/session";
import {
  profileSchema,
  teamSchema,
  type IdentityActionState,
} from "@/lib/identity-contract";
const failure = (message: string): IdentityActionState => ({
  ok: false,
  message,
});

export async function requestEmailCode(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  if (!emailAuthReady())
    return failure(
      "Email sign-in is not open yet. Browsing and the validator remain available.",
    );
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return failure("Enter a valid email address.");
  try {
    const client = await getSessionClient();
    if (!client)
      return failure("Account service is unavailable. Try again later.");
    const { error } = await client.auth.signInWithOtp({
      email: email.data,
      options: { shouldCreateUser: true },
    });
    if (error)
      return failure(
        "We could not send a code. Wait before retrying, or contact the project through Participate.",
      );
    return {
      ok: true,
      message:
        "Check your email for your one-time sign-in code. It expires after one hour.",
    };
  } catch {
    return failure("Account service is unavailable. Try again later.");
  }
}
export async function verifyEmailCode(
  _: IdentityActionState,
  form: FormData,
): Promise<IdentityActionState> {
  const input = z
    .object({
      email: z.email().max(254),
      token: z.string().regex(/^\d{6,10}$/),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return failure(
      "Enter your email address and the numeric code from the email.",
    );
  try {
    const client = await getSessionClient();
    if (!client) return failure("Account service is unavailable.");
    const { error } = await client.auth.verifyOtp({
      ...input.data,
      type: "email",
    });
    if (error)
      return failure(
        "This code is invalid or expired. Request a new code and try again.",
      );
  } catch {
    return failure("Account service is unavailable.");
  }
  redirect("/account");
}
export async function signOut() {
  const client = await getSessionClient();
  if (client) await client.auth.signOut({ scope: "local" });
  redirect("/account");
}
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
