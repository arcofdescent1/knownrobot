import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { IdentityForm } from "@/components/identity-form";
import { emailAuthReady, getSessionClient } from "@/lib/supabase/session";
import { pageMetadata } from "@/lib/seo";
import { oneRelation } from "@/lib/identity-reader";
import {
  requestEmailCode,
  verifyEmailCode,
  saveProfile,
  signOut,
  createTeam,
  manageTeam,
} from "./actions";
export const metadata = pageMetadata(
  "/account",
  "Your Known Robot account",
  "Manage your Known Robot profile, teams, invitations and contributions.",
  { index: false },
);
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const client = await getSessionClient();
  const user = client ? (await client.auth.getUser()).data.user : null;
  if (!user?.email_confirmed_at)
    return (
      <>
        <SiteHeader />
        <main className="editorial-page identity-page">
          <h1>Your Known Robot identity.</h1>
          <p>
            Sign in with your email. No GitHub or Hugging Face account required.
            A confirmed email does not verify your affiliation, expertise or
            evaluation claims.
          </p>
          {!emailAuthReady() ? (
            <p role="status">
              Public email sign-in is not open yet while the production sender
              is configured. The registry and local validator remain
              account-free.
            </p>
          ) : null}
          <IdentityForm
            action={requestEmailCode}
            label="Send sign-in code"
            disabled={!emailAuthReady()}
          >
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
          </IdentityForm>
          <IdentityForm
            action={verifyEmailCode}
            label="Verify code"
            disabled={!emailAuthReady()}
          >
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              One-time code
              <input
                name="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                required
              />
            </label>
          </IdentityForm>
          <p>
            Account email and authentication credentials are private. Profile
            details become public only when you explicitly save your contributor
            profile.
          </p>
          <Link href="/participate">Questions or account help →</Link>
        </main>
      </>
    );
  const [profileResult, memberships, invitations, drafts] = await Promise.all([
    client!.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    client!
      .from("organization_members")
      .select("role,organization_id,organizations(slug,name)")
      .eq("profile_id", user.id),
    client!
      .from("team_invitations")
      .select("organization_id,role,expires_at,organizations(name)")
      .eq("recipient_id", user.id)
      .is("resolved_at", null)
      .gt("expires_at", new Date().toISOString()),
    client!
      .from("evaluations")
      .select("id,published_at,skills(name)")
      .eq("submitted_by", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (
    [profileResult, memberships, invitations, drafts].some(
      (result) => result.error,
    )
  )
    throw new Error("Account data is unavailable. Retry shortly.");
  const profile = profileResult.data;
  const teamMemberships = memberships.data?.map((member) => ({
    ...member,
    organizations: oneRelation(member.organizations),
  }));
  const pendingInvitations = invitations.data?.map((invite) => ({
    ...invite,
    organizations: oneRelation(invite.organizations),
  }));
  const ownEvaluations = drafts.data?.map((draft) => ({
    ...draft,
    skills: oneRelation(draft.skills),
  }));
  return (
    <>
      <SiteHeader />
      <main className="editorial-page identity-page">
        <h1>Your contributor workspace.</h1>
        <p>
          Signed in as {user.email}. Your account ID: <code>{user.id}</code>.
        </p>
        <form action={signOut}>
          <button>Sign out</button>
        </form>
        <section>
          <h2>Public profile</h2>
          <p>
            Your claimed handle is permanent. Affiliation and external links are
            self-declared, not endorsements or proof of account ownership.
          </p>
          {profile?.handle ? (
            <Link href={`/people/${profile.handle}`}>
              View your public profile →
            </Link>
          ) : null}
          <IdentityForm action={saveProfile} label="Save public profile">
            <label>
              Handle
              <input
                name="handle"
                required
                defaultValue={profile?.handle || ""}
                readOnly={!!profile?.handle}
                maxLength={39}
                pattern="[a-z0-9][a-z0-9-]{2,38}"
              />
            </label>
            <label>
              Display name
              <input
                name="display_name"
                required
                defaultValue={profile?.display_name || ""}
                maxLength={100}
              />
            </label>
            <label>
              Bio
              <textarea
                name="bio"
                defaultValue={profile?.bio || ""}
                maxLength={1000}
              />
            </label>
            <label>
              Affiliation (self-declared)
              <input
                name="affiliation"
                defaultValue={profile?.affiliation || ""}
                maxLength={200}
              />
            </label>
            <label>
              GitHub link (optional)
              <input
                name="github_url"
                type="url"
                defaultValue={profile?.github_url || ""}
              />
            </label>
            <label>
              Hugging Face link (optional)
              <input
                name="huggingface_url"
                type="url"
                defaultValue={profile?.huggingface_url || ""}
              />
            </label>
            <label className="identity-consent">
              <input type="checkbox" name="public_consent" required />
              Publish these details and link my public contributions to this
              identity.
            </label>
          </IdentityForm>
        </section>
        <section>
          <h2>Teams</h2>
          <p>
            Members and roles are public. Team owners manage membership, not
            registry verification status. Invitations are addressed to existing
            Known Robot handles and expire after seven days.
          </p>
          {teamMemberships?.map((member) => (
            <div key={member.organization_id}>
              <p>
                <Link href={`/teams/${member.organizations?.slug}`}>
                  {member.organizations?.name}
                </Link>{" "}
                — {member.role}
              </p>
              <IdentityForm action={manageTeam} label="Apply team change">
                <input
                  type="hidden"
                  name="team_id"
                  value={member.organization_id}
                />
                <label>
                  Operation
                  <select name="operation">
                    <option value="leave">Leave team</option>
                    {member.role !== "member" ? (
                      <>
                        <option value="invite">Invite contributor</option>
                        <option value="cancel">Cancel invitation</option>
                        <option value="remove">Remove member</option>
                        {member.role === "owner" ? (
                          <option value="transfer">Transfer ownership</option>
                        ) : null}
                      </>
                    ) : null}
                  </select>
                </label>
                <label>
                  Target handle (except leaving)
                  <input name="handle" maxLength={39} />
                </label>
                <label>
                  Invitation role
                  <select name="role">
                    <option value="member">Member</option>
                    {member.role === "owner" ? (
                      <option value="admin">Admin</option>
                    ) : null}
                  </select>
                </label>
                <p>
                  Ownership transfer is immediate and changes your role to
                  admin. Owners cannot be removed or leave before transferring.
                </p>
              </IdentityForm>
            </div>
          ))}
          {pendingInvitations?.map((invite) => (
            <div key={invite.organization_id}>
              <p>
                Invitation to {invite.organizations?.name} as {invite.role},
                expires {invite.expires_at}.
              </p>
              <IdentityForm action={manageTeam} label="Respond to invitation">
                <input
                  type="hidden"
                  name="team_id"
                  value={invite.organization_id}
                />
                <label>
                  Response
                  <select name="operation">
                    <option value="accept">
                      Accept public team membership
                    </option>
                    <option value="decline">Decline</option>
                  </select>
                </label>
              </IdentityForm>
            </div>
          ))}
          <IdentityForm action={createTeam} label="Create team">
            <label>
              Team slug
              <input
                name="slug"
                required
                maxLength={39}
                pattern="[a-z0-9][a-z0-9-]{2,38}"
              />
            </label>
            <label>
              Team name
              <input name="name" required maxLength={100} />
            </label>
            <label>
              Description
              <textarea name="description" maxLength={1000} />
            </label>
            <label className="identity-consent">
              <input type="checkbox" name="public_consent" required />
              Publish team details and my owner membership.
            </label>
          </IdentityForm>
        </section>
        <section>
          <h2>Your evaluations</h2>
          <Link href="/submit">Submit an evaluation →</Link>
          {ownEvaluations?.map((draft) => (
            <p key={draft.id}>
              {draft.skills?.name} —{" "}
              {draft.published_at ? (
                <Link href={`/evaluations/${draft.id}`}>Public result</Link>
              ) : (
                <Link href={`/submit?draft=${draft.id}`}>
                  Review private draft and publish
                </Link>
              )}
            </p>
          ))}
          {!ownEvaluations?.length ? <p>No evaluations submitted yet.</p> : null}
        </section>
        <p>
          <Link href="/account/export">
            Download your identity and contribution records (JSON) →
          </Link>
        </p>
      </main>
    </>
  );
}
