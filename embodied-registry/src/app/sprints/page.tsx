import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { SiteHeader } from "@/components/site-header";
import { sprint, currentSprintView } from "@/lib/sprints";
import { teamDigest, protocolDigest } from "@/lib/sprint-contract";

export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata("/sprints", "Reproduction Sprints — Known Robot", "A public, accountable reproduction study: committed teams, frozen protocol, independent evidence review and joint reports.");
const repo = "https://github.com/arcofdescent1/knownrobot";
const date = (value: string) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));

export default function SprintsPage() {
  const { state, applicationsOpen } = currentSprintView();
  return <>
    <SiteHeader />
    <main className="sprints-page">
      <section className="sprint-hero">
        <div className="sprint-status">{state.status}</div>
        <p className="kicker">REPRODUCTION {sprint.id.toUpperCase()}</p>
        <h1>One policy.<br/>Different hardware.<br/><em>Public evidence.</em></h1>
        <p className="editorial-deck">Three to five teams. Two weeks. Successful, failed, blocked and unsafe attempts preserved in a reviewed joint report. Dates remain provisional until the readiness gate passes and the event lead starts the sprint.</p>
        <div className="sprint-hero-actions">
          <a className="primary-link sprint-apply" href={applicationsOpen ? `${repo}/issues/new?template=sprint-application.yml` : `${repo}/discussions/2`}>{applicationsOpen ? "Apply with your configuration ↗" : "Discuss the next sprint ↗"}</a>
          <a href="/reproduction-sprints.ics">Download session calendar ↓</a>
        </div>
      </section>
      <section className="sprint-brief" aria-labelledby="readiness">
        <div className="brief-heading"><p className="section-number">01 / READINESS · NO IMPLIED COMMITMENTS</p><h2 id="readiness">{state.ready ? "Readiness requirements met" : "Kickoff is not yet confirmed"}</h2><p>{sprint.teams.length} named teams; {sprint.reviewers.length} named reviewers. A calendar date is not proof of readiness.</p></div>
        {state.blockers.length > 0 && <ul>{state.blockers.map(b => <li key={b}>{b}</li>)}</ul>}
        <p>Event lead: {sprint.lead ? <a href={sprint.lead.comment}>@{sprint.lead.handle} · public commitment ↗</a> : "Not appointed"}</p>
        <p>Reviewers: {sprint.reviewers.length ? sprint.reviewers.map(r => <a key={r.handle} href={r.comment}>@{r.handle} · independent review commitment ↗ </a>) : "No confirmed independent reviewers"}</p>
        <p><a href="/sprints/status.json">Inspect the machine-readable operating record →</a></p>
      </section>
      <section className="sprint-contract" aria-labelledby="roster">
        <div><p className="section-number">02 / PUBLIC ROSTER</p><h2 id="roster">Actual commitments, not expressions of interest.</h2></div>
        {!sprint.teams.length ? <p>No teams have publicly confirmed participation yet. Applications are not counted as commitments.</p> : <div className="contract-grid">{sprint.teams.map(t => <article key={t.id}>
          <h3>{t.name}</h3><p>@{t.lead.handle} · {t.physical ? "Physical hardware" : "Simulation"}</p><p>{t.configuration}</p>
          <p>Assigned independent reviewer: @{t.reviewer}</p>
          <p><a href={t.configurationUrl}>Configuration record ↗</a> · <a href={t.application}>Application ↗</a> · <a href={t.lead.comment}>Signed commitment ↗</a></p>
          <p>Commitment digest: <code className="sprint-digest">{teamDigest(sprint, t)}</code></p>
          {t.evidence ? <><p>{t.evidence.outcome} · {t.evidence.successes}/{t.evidence.completed} successes · {t.evidence.planned} planned</p><p><a href={t.evidence.url}>Evidence ↗</a> · <a href={t.evidence.manifest}>Immutable manifest ↗</a> · <a href={t.evidence.trials}>All trial outcomes ↗</a></p>
            {t.evidence.reviews.map(r => <p key={r.comment}><a href={r.comment}>@{r.reviewer}: {r.decision.replaceAll("_", " ")} ↗</a> — {r.rationale}</p>)}
            {t.evidence.failures.map(f => <p key={f.improvement}>{f.description} · <a href={f.improvement}>Resulting improvement ↗</a></p>)}
          </> : <p>Evidence not submitted — outcome remains outstanding.</p>}
        </article>)}</div>}
      </section>
      <section className="sprint-brief">
        <div className="brief-heading"><p className="section-number">03 / IMMUTABLE ARTIFACT</p><h2>{sprint.title}</h2><p>Selected source revision is pinned. This does not imply the publisher endorses the study or that the proposed protocol has been agreed.</p></div>
        <p><a href={`https://huggingface.co/${sprint.policy.repository}/tree/${sprint.policy.revision}`}>{sprint.policy.repository} ↗</a></p>
        <p>Commit: <code className="sprint-digest">{sprint.policy.revision}</code></p>
        <p>Framework: ACT / LeRobot. Declared target: SO-101 manipulation. Compatibility is not safety certification.</p>
      </section>
      <section className="sprint-contract" aria-labelledby="protocol">
        <div><p className="section-number">04 / PROPOSED PROTOCOL</p><h2 id="protocol">Agree before counted trials.</h2><p>Consent binds the policy revision, entire protocol, schedule and each team&apos;s declared configuration. Changes invalidate old commitments.</p><p>Protocol digest: <code className="sprint-digest">{protocolDigest(sprint)}</code></p></div>
        <div className="contract-grid">{Object.entries(sprint.protocol).map(([key, value]) => <article key={key}><h3>{key[0].toUpperCase() + key.slice(1)}</h3><p>{value}</p></article>)}</div>
      </section>
      <section className="sprint-timeline">
        <p className="section-number">05 / SHARED CLOCK · AMERICA/DENVER</p><h2>Every milestone has an accountable gate.</h2>
        <ol>{Object.entries(sprint.schedule).map(([key, value]) => <li key={key}><time dateTime={value}>{date(value)}</time><strong>{({ applicationsOpen: "Applications open", applicationsClose: "Applications close", freeze: "Roster + protocol freeze", kickoff: "Kickoff — only if ready", evidence: "Every team outcome due", review: "Independent review due", results: "Public results session", report: "Joint report + improvement issues" } as Record<string, string>)[key]}</strong><span>{key === "freeze" || key === "kickoff" ? "Requires three committed teams, two physical setups, named lead and independent reviewers, and matching consent." : "Tracked in the public operating record; dates never auto-complete work."}</span></li>)}</ol>
      </section>
      <section className="sprint-links">
        <div><p className="kicker">06 / CLOSE THE LOOP</p><h2>Reviewed failures become product improvements.</h2><p>Outstanding outcomes: {state.evidencePending.join(", ") || (sprint.teams.length ? "None" : "No teams confirmed")}. Outstanding reviews: {state.reviewPending.join(", ") || (sprint.teams.length ? "None" : "No evidence yet")}.</p>
          <p>{sprint.session ? <a href={sprint.session.notes}>Public results-session notes ↗</a> : "Results session not recorded."}</p>
          <p>{sprint.report ? <a href={sprint.report.url}>Joint report with credits and corrections ↗</a> : "Joint report not published."}</p>
          {sprint.cancelled && <p>Cancellation: {sprint.cancelled.reason} · <a href={sprint.cancelled.confirmation.comment}>Lead&apos;s decision ↗</a></p>}
        </div>
        <div><a href={`${repo}/issues/new?template=sprint-evidence.yml`}>Submit evidence, including failed attempts →</a><a href={`${repo}/issues/new?template=sprint-review.yml`}>Assigned reviewer: publish a review →</a><a href={`${repo}/discussions/2`}>Sprint discussion →</a><a href={`${repo}/blob/main/community/sprints/README.md`}>Operating handbook and confirmation procedure →</a><a href={`${repo}/issues?q=label%3Asprint-operations`}>Accountable operations and improvements →</a></div>
      </section>
    </main>
  </>;
}
