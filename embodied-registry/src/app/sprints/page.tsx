import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { SiteHeader } from "@/components/site-header";
import { SprintApplicationForm } from "@/components/sprint-application-form";
import { sprint, currentSprintView } from "@/lib/sprints";
import { protocolDigest } from "@/lib/sprint-contract";
import { getSessionClient } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata("/sprints", "Reproduction Sprints — Known Robot", "Join a bounded, public robot-policy reproduction with an immutable artifact, shared protocol, independent review, and useful successful or failed outcomes.");
const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));

export default async function SprintsPage() {
  const { state, applicationsOpen } = currentSprintView();
  const session = await getSessionClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const service = user ? getServiceSupabaseClient() : null;
  const application = service ? (await service.from("sprint_applications").select("status,role,updated_at").eq("sprint_id", sprint.id).eq("applicant_id", user!.id).maybeSingle()).data : null;
  const sourceUrl = `https://huggingface.co/${sprint.policy.repository}/tree/${sprint.policy.revision}`;
  return <>
    <SiteHeader />
    <main className="sprints-page">
      <section className="sprint-hero">
        <div className="sprint-status">{applicationsOpen ? "Applications open" : state.status}</div>
        <p className="kicker">REPRODUCTION {sprint.id.toUpperCase()}</p>
        <h1>Reproduce one policy.<br/><em>Publish what happens.</em></h1>
        <p className="editorial-deck">Join a focused two-week collaboration around a pinned ACT policy for SO-101. Successful, failed, blocked, and unsafe attempts all improve the shared record.</p>
        <div className="sprint-value-grid" aria-label="Participant value and commitment">
          <div><span>Artifact</span><strong>{sprint.title}</strong><small>Immutable upstream revision</small></div>
          <div><span>You contribute</span><strong>One bounded role</strong><small>Run, independently review, or coordinate</small></div>
          <div><span>You receive</span><strong>Attributable public credit</strong><small>Reviewed evidence and a durable contributor record</small></div>
          <div><span>Commitment</span><strong>Two weeks</strong><small>Shared protocol, async updates, and published outcome</small></div>
        </div>
        <div className="sprint-hero-actions">
          <a className="primary-link sprint-apply" href="#apply">Apply to join the sprint</a>
          <a href="/reproduction-sprints.ics">Add provisional dates to calendar ↓</a>
        </div>
      </section>

      <section className="sprint-readiness" aria-labelledby="readiness">
        <div><p className="section-number">READINESS · ONE HONEST STATUS</p><h2 id="readiness">{state.ready ? "Ready for confirmed kickoff" : "Recruiting before kickoff"}</h2><p>Applications are open. An application is private and does not become a public commitment until the participant, configuration, protocol, reviewer, and event lead are confirmed.</p></div>
        <div className="readiness-progress">
          <div><strong>{sprint.teams.length}/3</strong><span>minimum teams confirmed</span></div>
          <div><strong>{sprint.reviewers.length}/2</strong><span>independent reviewers confirmed</span></div>
          <div><strong>{sprint.lead ? "Named" : "Open"}</strong><span>event lead</span></div>
        </div>
        <div className="readiness-note"><strong>{state.ready ? "The readiness gate is satisfied." : "Kickoff remains provisional."}</strong><p>{state.ready ? "Confirmed participants can proceed on the published schedule." : "KnownRobot will only confirm kickoff after the minimum roster, physical setups, reviewers, lead, and matching protocol consent are documented."}</p><a href="/sprints/status.json">Machine-readable operating record →</a></div>
      </section>

      <section className="sprint-brief sprint-artifact" aria-labelledby="artifact">
        <div className="brief-heading"><p className="section-number">01 / PINNED ARTIFACT</p><h2 id="artifact">{sprint.title}</h2><p>Everyone works from the same immutable revision. The upstream publisher has not endorsed this sprint, and the artifact is not treated as compatible until evidence is contributed.</p></div>
        <dl className="artifact-facts"><div><dt>Repository</dt><dd><a href={sourceUrl}>{sprint.policy.repository} ↗</a></dd></div><div><dt>Revision</dt><dd><code className="sprint-digest">{sprint.policy.revision}</code></dd></div><div><dt>Framework</dt><dd>ACT / LeRobot</dd></div><div><dt>Target</dt><dd>SO-101 tabletop pick-and-place</dd></div></dl>
      </section>

      <section className="sprint-contract" aria-labelledby="protocol">
        <div><p className="section-number">02 / SHARED PROTOCOL</p><h2 id="protocol">Agree before counted trials.</h2><p>Consent binds the exact policy revision, protocol, schedule, and declared configuration. Teams publish every counted outcome; physical and simulated results remain separate.</p><p>Protocol digest: <code className="sprint-digest">{protocolDigest(sprint)}</code></p></div>
        <div className="contract-grid">{Object.entries(sprint.protocol).map(([key, value]) => <article key={key}><h3>{key[0].toUpperCase() + key.slice(1)}</h3><p>{value}</p></article>)}</div>
      </section>

      <section className="sprint-timeline"><p className="section-number">03 / PROVISIONAL SCHEDULE · AMERICA/DENVER</p><h2>Every milestone has an accountable gate.</h2><ol>{Object.entries(sprint.schedule).map(([key, value]) => <li key={key}><time dateTime={value}>{date(value)}</time><strong>{({ applicationsOpen: "Applications open", applicationsClose: "Applications close", freeze: "Roster + protocol freeze", kickoff: "Kickoff — only if ready", evidence: "Every team outcome due", review: "Independent review due", results: "Public results session", report: "Joint report + improvements" } as Record<string, string>)[key]}</strong><span>{key === "freeze" || key === "kickoff" ? "Only proceeds after the readiness gate passes." : "Tracked in the public operating record."}</span></li>)}</ol></section>

      <section className="sprint-application" id="apply" aria-labelledby="apply-title">
        <div><p className="section-number">04 / NATIVE APPLICATION</p><h2 id="apply-title">Choose one useful role.</h2><p>Apply without leaving KnownRobot. Applications remain private during review. Accepted participants explicitly approve the configuration and profile details that become public.</p><ul><li><strong>Team:</strong> run and document a physical or simulated attempt.</li><li><strong>Reviewer:</strong> independently inspect another team&apos;s protocol and evidence.</li><li><strong>Event lead:</strong> coordinate gates, dates, and the public results loop.</li></ul></div>
        <div className="sprint-application-panel">
          {!applicationsOpen ? <div className="form-notice"><h3>Applications are currently closed.</h3><p>Browse <Link href="/discussions?kind=reproduction_request">open reproduction requests</Link> to contribute now.</p></div>
            : application ? <div className="application-receipt"><p className="eyebrow">Application received</p><h3>{application.role.replaceAll("_", " ")}</h3><p>Status: <strong>{application.status}</strong></p><p>Last updated {new Date(application.updated_at).toLocaleDateString("en-US")}.</p><p>Your application is not a public commitment until KnownRobot confirms the roster and you approve the final protocol.</p><details><summary>Update this application</summary><SprintApplicationForm sprintId={sprint.id} /></details></div>
            : user ? <SprintApplicationForm sprintId={sprint.id} />
            : <div className="form-notice"><h3>Sign in to apply</h3><p>Your account keeps the application attributable and lets you return to its status. Application details remain private unless you are accepted and consent to publication.</p><Link className="primary-link" href="/login">Sign in and continue →</Link><p>New to KnownRobot? <Link href="/signup">Create an account</Link>.</p></div>}
        </div>
      </section>

      {sprint.teams.length ? <section className="sprint-contract" aria-labelledby="roster"><div><p className="section-number">05 / CONFIRMED ROSTER</p><h2 id="roster">Public commitments</h2></div><div className="contract-grid">{sprint.teams.map((team) => <article key={team.id}><h3>{team.name}</h3><p>@{team.lead.handle} · {team.physical ? "Physical hardware" : "Simulation"}</p><p>{team.configuration}</p></article>)}</div></section> : null}

      <section className="sprint-links"><div><p className="kicker">05 / COMPLETE THE LOOP</p><h2>Every outcome becomes useful evidence.</h2><p>Accepted teams document their exact setup, trials, interventions, failures, and safety stops. Independent reviewers assess the record before KnownRobot publishes the joint report.</p></div><div><Link href="/submit">Publish evaluation evidence →</Link><Link href="/discussions?kind=reproduction_request">Open reproduction discussions →</Link><a href="/sprints/status.json">Inspect operating record →</a></div></section>
    </main>
  </>;
}
