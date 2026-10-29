import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { AccountNav } from "@/components/account-nav";
import { requireIdentity } from "@/lib/supabase/session";
import { signOut } from "@/app/auth-actions";
import { pageMetadata } from "@/lib/seo";
export const metadata=pageMetadata("/settings/account","Account settings — Known Robot","Manage your KnownRobot account.",{index:false});
export const dynamic="force-dynamic";
export default async function AccountSettings(){const{user}=await requireIdentity();const providers=[...new Set((user.identities||[]).map(identity=>identity.provider))];return <><SiteHeader/><main className="app-page narrow-app"><AccountNav/><p className="eyebrow">Settings</p><h1>Account</h1><section className="settings-panel"><h2>Email</h2><p>{user.email}</p><p className="muted">Verified account email. It is never displayed on your public profile.</p></section><section className="settings-panel"><h2>Connected login methods</h2><p>{providers.length?providers.join(", "):"Email and password"}</p><p>GitHub login appears on the login page when the production OAuth provider is enabled. Hugging Face ownership is proved repository-first from an artifact claim, not inferred from a login.</p></section><section className="settings-panel"><h2>Your data</h2><p><Link href="/account/export">Download account and contribution data (JSON)</Link></p><p><Link href="/privacy">Review privacy boundaries</Link></p></section><section className="settings-panel danger-zone"><h2>Session</h2><form action={signOut}><button type="submit">Sign out</button></form></section></main></>}
