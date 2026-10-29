import { SiteHeader } from "@/components/site-header";
import { AccountNav } from "@/components/account-nav";
import { AuthForm, PasswordFields } from "@/components/auth-form";
import { requireIdentity } from "@/lib/supabase/session";
import { updatePassword } from "@/app/auth-actions";
import { pageMetadata } from "@/lib/seo";
export const metadata=pageMetadata("/settings/security","Security settings — Known Robot","Update your KnownRobot password.",{index:false});
export const dynamic="force-dynamic";
export default async function SecuritySettings(){await requireIdentity();return <><SiteHeader/><main className="app-page narrow-app"><AccountNav/><p className="eyebrow">Settings</p><h1>Security</h1><section className="settings-panel"><h2>Change password</h2><p>Changing your password does not change public profiles, claims, or contributions.</p><AuthForm action={updatePassword} label="Change password"><PasswordFields confirmation/></AuthForm></section><section className="settings-panel"><h2>Account safety</h2><p>Use a unique password. KnownRobot will never ask you to send a password, reset token, API token, or private repository credential through a discussion or message.</p></section></main></>}
