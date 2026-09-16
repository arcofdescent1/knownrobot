import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { statusLabels, statuses, registryUrl, displayStatus, type RegistryResult } from "@/lib/evidence-contract";

export function RegistryClient({ result }: { result: RegistryResult }) {
  const { state, data, filters } = result;
  const connected = state === "live" || state === "demo";
  const pages = Math.ceil(data.total / 30);
  return <main><SiteHeader />
    <section className="workspace" id="registry">
      <aside><div className="side-section"><p className="eyebrow">EXPLORE</p><Link className="side-link selected" href="/">Registry</Link><Link className="side-link" href="/validator">Validator</Link><Link className="side-link" href="/sprints">Reproduction sprints</Link><Link className="side-link" href="/field-notes">Field notes</Link></div>
        <div className="manifest-card"><span>PORTABLE EVIDENCE</span><h3>Make transfer testable.</h3><p>Keep your manifest with your existing policy repository.</p><Link href="/validator">Check a policy →</Link></div>
      </aside>
      <div className="content">
        {state === "demo" && <div className="demo-ribbon" role="note">DEMONSTRATION ONLY · Fictional example, not published robot evidence. Statistics below count examples.</div>}
        <div className="intro"><div><p className="kicker">OPEN ROBOT SKILL INDEX</p><h1>Know what works.<br />Before the robot moves.</h1><p className="lede">Inspect the configuration, protocol, evidence, failures, and independent review behind each published claim.</p></div>
          {connected && <div className="network-stat" aria-label={state === "demo" ? "Example statistics" : "Published registry statistics"}><div><strong>{data.stats.evaluations}</strong><span>evaluations</span></div><div><strong>{data.stats.hardware}</strong><span>hardware profiles</span></div><div><strong>{data.stats.contributors}</strong><span>contributors</span></div></div>}
        </div>
        {connected ? <>
          <form className="search-row" action="/" method="get">
            <label className="search-box"><span aria-hidden="true">⌕</span><input name="q" defaultValue={filters.query} maxLength={200} aria-label="Search all published evaluations" placeholder="Search policies, robots, contributors…" /></label>
            <label><span className="sr-only">Verification status</span><select name="status" defaultValue={filters.status}><option value="">All verification levels</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <button className="filter-button" type="submit">Search</button><Link href="/">Clear</Link>
          </form>
          <div className="section-heading"><div><h2>{state === "demo" ? "Format example" : "Published evaluations"}</h2><p>{data.total} matching records · searches include all published pages</p></div><span className="sort-label">Publication date</span></div>
          <div className="evaluation-list">{data.records.map(record => <article className="evaluation-card" key={record.id}>
            <div className="skill-icon" aria-hidden="true">{record.hardware.robot_family.slice(0,2)}</div>
            <div className="skill-main"><div className="skill-title-row"><h3><Link href={`/evaluations/${record.id}`}>{record.skill.name}</Link></h3><span className={`status ${displayStatus(record) === "self_tested" ? "amber" : "mint"}`}>{statusLabels[displayStatus(record)]}</span></div><p>Evaluated by {record.submitter.display_name ?? record.submitter.handle ?? "Unnamed contributor"}</p><div className="tags"><span>{record.hardware.robot_family}</span><span>{record.skill.framework}</span></div></div>
            <div className="result"><strong>{record.evaluation.success_rate === null ? "Not reported" : record.evaluation.success_rate.toFixed(1) + "%"}</strong><span>reported success rate</span><small>{record.evaluation.trial_count} trials · {new Date(record.published_at).toISOString().slice(0,10)}</small></div><Link className="row-arrow" href={`/evaluations/${record.id}`} aria-label={`Inspect evidence for ${record.skill.name}`}>→</Link>
          </article>)}</div>
          {!data.records.length && <section className="empty-state"><h2>{data.stats.evaluations === 0 ? "No public evidence yet" : "No records on this page"}</h2><p>{data.stats.evaluations === 0 ? "The registry is connected, but no evaluations have been published. We do not substitute sample successes." : "Adjust your search or return to the first results page."}</p><Link href={registryUrl(filters, 1)}>First results page</Link> · <Link href="/participate">Contribute a real attempt →</Link></section>}
          {pages > 1 && <nav className="registry-pagination" aria-label="Results pagination">{filters.page > 1 && <Link href={registryUrl(filters, filters.page - 1)}>← Previous</Link>}<span>Page {filters.page} of {pages}</span>{filters.page < pages && <Link href={registryUrl(filters, filters.page + 1)}>Next →</Link>}</nav>}
        </> : <section className="empty-state" role={state === "unavailable" ? "alert" : "status"}><h2>{state === "unavailable" ? "Evidence temporarily unavailable" : "Evidence collection is not connected yet"}</h2><p>{state === "unavailable" ? "We could not retrieve the public evidence. No example results or zero-valued network statistics are substituted." : "Known Robot is preparing its public evidence collection. No robot performance claims are implied."}</p><Link href="/">Try again</Link> · <Link href="/validator">Use the offline validator</Link> · <Link href="/sprints">Join a reproduction sprint</Link></section>}
      </div>
    </section>
  </main>;
}
