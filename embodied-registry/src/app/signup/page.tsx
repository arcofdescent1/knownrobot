import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm, PasswordFields } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionClient } from "@/lib/supabase/session";
import { pageMetadata } from "@/lib/seo";
import { signInWithGitHub, signUp } from "@/app/auth-actions";
export const metadata = pageMetadata("/signup", "Create an account — Known Robot", "Create a KnownRobot contributor account.", { index: false });
export default async function SignupPage() {
  const client = await getSessionClient(); const user = client ? (await client.auth.getUser()).data.user : null; if (user?.email_confirmed_at) redirect("/dashboard");
  const github = process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "true";
  return <AuthShell eyebrow="Join the robotics evidence network" title="Create your KnownRobot account" intro="Import, validate, discuss, evaluate, and follow canonical robotics artifacts." footer={<span>Already have an account? <Link href="/login">Log in</Link></span>}>
    {github ? <form action={signInWithGitHub}><button className="oauth-button" type="submit">Sign up with GitHub</button></form> : null}{github ? <div className="auth-divider"><span>or</span></div> : null}
    <AuthForm action={signUp} label="Create account"><label htmlFor="signup-email">Email<input id="signup-email" name="email" type="email" autoComplete="email" required maxLength={254} /></label><PasswordFields confirmation /><label className="checkbox-label"><input type="checkbox" name="terms" required /> I agree to the <Link href="/privacy">privacy and contribution terms</Link>.</label></AuthForm>
  </AuthShell>;
}
