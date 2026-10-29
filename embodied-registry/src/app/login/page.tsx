import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { getSessionClient } from "@/lib/supabase/session";
import { pageMetadata } from "@/lib/seo";
import { signInWithGitHub, signInWithPassword } from "@/app/auth-actions";
export const metadata = pageMetadata("/login", "Log in — Known Robot", "Log in to your KnownRobot account.", { index: false });
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ oauth?: string; error?: string }> }) {
  const client = await getSessionClient(); const user = client ? (await client.auth.getUser()).data.user : null; if (user?.email_confirmed_at) redirect("/dashboard");
  const query = await searchParams; const github = process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "true";
  return <AuthShell eyebrow="Welcome back" title="Log in to KnownRobot" intro="Continue your artifact work, discussions, evaluations, and private coordination." footer={<span>New to KnownRobot? <Link href="/signup">Create an account</Link></span>}>
    {github ? <form action={signInWithGitHub}><button className="oauth-button" type="submit">Continue with GitHub</button></form> : null}
    {github ? <div className="auth-divider"><span>or</span></div> : null}
    {query.oauth === "unavailable" ? <p className="form-error" role="alert">GitHub login is not available. Use email and password.</p> : null}
    {query.error === "callback" ? <p className="form-error" role="alert">That sign-in link is invalid or expired. Try again.</p> : null}
    <AuthForm action={signInWithPassword} label="Log in"><label htmlFor="email">Email<input id="email" name="email" type="email" autoComplete="email" required maxLength={254} /></label><label htmlFor="login-password">Password<input id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={128} /></label><div className="auth-row auth-row-end"><Link href="/forgot-password">Forgot password?</Link></div></AuthForm>
  </AuthShell>;
}
