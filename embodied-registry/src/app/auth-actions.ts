"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionClient, emailAuthReady } from "@/lib/supabase/session";
import { loginSchema, passwordUpdateSchema, resetRequestSchema, signUpSchema, type AuthActionState } from "@/lib/auth-contract";

const fail = (message: string): AuthActionState => ({ ok: false, message });
const success = (message: string): AuthActionState => ({ ok: true, message });
async function origin() {
  if (process.env.NODE_ENV === "production") return "https://knownrobot.com";
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host");
  const proto = incoming.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "https://knownrobot.com";
}
export async function signUp(_: AuthActionState, form: FormData): Promise<AuthActionState> {
  if (!emailAuthReady()) return fail("Account registration is temporarily unavailable.");
  const parsed = signUpSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const client = await getSessionClient();
  if (!client) return fail("Account service is unavailable.");
  const callback = `${await origin()}/auth/callback?next=/dashboard`;
  const { error } = await client.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { emailRedirectTo: callback } });
  if (error) return fail(error.status === 429 ? "Too many attempts. Wait and try again." : "Registration could not be completed. Check the fields or use account recovery if you may already be registered.");
  return success("Check your email to verify your account, then sign in.");
}
export async function signInWithPassword(_: AuthActionState, form: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const client = await getSessionClient();
  if (!client) return fail("Account service is unavailable.");
  const { data, error } = await client.auth.signInWithPassword(parsed.data);
  if (error || !data.user?.email_confirmed_at) return fail("Email or password is incorrect, or the email is not verified.");
  redirect("/dashboard");
}
export async function requestPasswordReset(_: AuthActionState, form: FormData): Promise<AuthActionState> {
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const client = await getSessionClient();
  if (!client) return fail("Account service is unavailable.");
  await client.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${await origin()}/auth/callback?next=/reset-password` });
  return success("If an account exists for that email, a password-reset link is on its way.");
}
export async function updatePassword(_: AuthActionState, form: FormData): Promise<AuthActionState> {
  const parsed = passwordUpdateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const client = await getSessionClient();
  if (!client) return fail("Account service is unavailable.");
  const { data: { user } } = await client.auth.getUser();
  if (!user) return fail("Open a fresh password-reset link and try again.");
  const { error } = await client.auth.updateUser({ password: parsed.data.password });
  if (error) return fail("The password could not be updated. Request a fresh reset link.");
  return success("Password updated. You can continue using KnownRobot.");
}
export async function signInWithGitHub() {
  if (process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED !== "true") redirect("/login?oauth=unavailable");
  const client = await getSessionClient();
  if (!client) redirect("/login?oauth=unavailable");
  const { data, error } = await client.auth.signInWithOAuth({ provider: "github", options: { redirectTo: `${await origin()}/auth/callback?next=/dashboard`, scopes: "read:user user:email" } });
  if (error || !data.url) redirect("/login?oauth=unavailable");
  redirect(data.url);
}
export async function signOut() {
  const client = await getSessionClient();
  if (client) await client.auth.signOut({ scope: "local" });
  redirect("/login");
}
