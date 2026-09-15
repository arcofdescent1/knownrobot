"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { EvaluationSummary, VerificationStatus } from "@/lib/types";

const statusLabel: Record<VerificationStatus, string> = { reproduced: "Reproduced", runner_verified: "Runner verified", self_tested: "Self-tested" };
const statusTone: Record<VerificationStatus, string> = { reproduced: "mint", runner_verified: "blue", self_tested: "amber" };
const activity = [["Evaluation reproduced", "Bimanual cable routing", "14 min ago"], ["Adapter published", "SO-101 wrist camera", "2 hr ago"], ["Benchmark updated", "Deformable Pick v1.2", "Yesterday"]];

export function RegistryClient({ evaluations, demo }: { evaluations: EvaluationSummary[]; demo: boolean }) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Set<VerificationStatus>>(new Set());
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return evaluations.filter((item) => (!term || [item.skill, item.author, item.robot, item.framework].some((value) => value.toLowerCase().includes(term))) && (!statuses.size || statuses.has(item.status)));
  }, [evaluations, query, statuses]);

  function toggleStatus(status: VerificationStatus) {
    setStatuses((current) => { const next = new Set(current); if (next.has(status)) next.delete(status); else next.add(status); return next; });
  }

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "search_robot_skill_evaluations", title: "Search robot skill evaluations",
      description: "Search the visible Known Robot evaluations by skill, author, robot, or framework.",
      inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input: unknown) {
        if (typeof input !== "object" || !input || !("query" in input) || typeof (input as { query: unknown }).query !== "string") {
          throw new Error("query must be a string");
        }
        const value = (input as { query: string }).query;
        setQuery(value);
        const matches = evaluations.filter((item) => [item.skill, item.author, item.robot, item.framework].some((field) => field.toLowerCase().includes(value.toLowerCase())));
        return { query: value, matches: matches.map(({ id, skill, robot, status }) => ({ id, skill, robot, status })) };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [evaluations]);

  return <main>
    <header className="topbar"><Link className="brand" href="/" aria-label="Known Robot home"><span className="brand-mark">KR</span><span>Known Robot</span><span className="alpha">ALPHA</span></Link><nav aria-label="Primary navigation"><Link className="nav-active" href="/">Registry</Link><Link href="/validator">Validator</Link><Link href="/sprints">Sprints</Link><Link href="/thesis">Thesis</Link><Link href="/field-notes">Field notes</Link><Link href="/participate">Participate</Link></nav><div className="top-actions"><Link className="primary-link" href="/sprints">Join Sprint 01 <span>↗</span></Link></div></header>
    <section className="workspace" id="registry">
      <aside><div className="side-section"><p className="eyebrow">EXPLORE</p><a className="side-link selected" href="#registry"><span>⌁</span> Registry</a><Link className="side-link" href="/thesis"><span>◇</span> Thesis</Link><Link className="side-link" href="/field-notes"><span>◌</span> Field notes</Link><Link className="side-link" href="/participate"><span>↗</span> Participate</Link></div><div className="side-section"><p className="eyebrow">FILTER BY STATUS</p>{(["reproduced", "runner_verified", "self_tested"] as VerificationStatus[]).map((status) => <label key={status}><input type="checkbox" checked={statuses.has(status)} onChange={() => toggleStatus(status)} /> {statusLabel[status]} <b>{evaluations.filter((item) => item.status === status).length}</b></label>)}</div><div className="manifest-card"><span>OPEN STANDARD</span><h3>Make transfer testable.</h3><p>Read the focused Phase 0 thesis and its boundaries.</p><Link href="/thesis">Read the thesis →</Link></div></aside>
      <div className="content">
        {demo && <div className="demo-ribbon">Example records · format demonstration</div>}
        <div className="intro"><div><p className="kicker">OPEN ROBOT SKILL INDEX</p><h1>Know what works.<br />Before the robot moves.</h1><p className="lede">Independent evidence for robot policies—across hardware, environments, and real-world trials.</p></div><div className="network-stat" aria-label="Registry network statistics"><div><strong>{evaluations.length}</strong><span>evaluations</span></div><div><strong>3</strong><span>robot configs</span></div><div><strong>3</strong><span>labs</span></div></div></div>
        <div className="search-row"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search skills, robots, or frameworks" placeholder="Search skills, robots, or frameworks…" /><kbd>⌘ K</kbd></label><button className="filter-button" onClick={() => setStatuses(new Set())}>Filters <span>{statuses.size}</span></button></div>
        <div className="section-heading"><div><h2>Illustrative evaluations</h2><p>{filtered.length} comparable {filtered.length === 1 ? "record" : "records"} showing the intended evidence structure.</p></div><span className="sort-label">Recently updated</span></div>
        <div className="evaluation-list">{filtered.map((evaluation) => <article className="evaluation-card" key={evaluation.id}><div className="skill-icon">{evaluation.robot.slice(0,2).toUpperCase()}</div><div className="skill-main"><div className="skill-title-row"><h3>{evaluation.skill}</h3><span className={`status ${statusTone[evaluation.status]}`}><i />{statusLabel[evaluation.status]}</span></div><p>by {evaluation.author}</p><div className="tags"><span>{evaluation.robot}</span><span>{evaluation.framework}</span></div></div><div className="result"><strong>{evaluation.successRate.toFixed(1)}%</strong><span>success rate</span><small>{evaluation.trialLabel}</small></div><span className="row-arrow" aria-hidden="true">·</span></article>)}{!filtered.length && <div className="empty-state"><strong>No matching evaluations</strong><p>Try a robot family, framework, or clear the active filters.</p><button onClick={() => { setQuery(""); setStatuses(new Set()); }}>Clear search</button></div>}</div>
        <section className="activity" id="activity"><div className="section-heading compact"><div><h2>Illustrative network activity</h2><p>How new evidence will strengthen compatibility claims.</p></div><Link href="/participate">Join the study →</Link></div><div className="activity-grid">{activity.map(([event, subject, time]) => <div className="activity-item" key={subject}><span className="pulse"/><div><strong>{event}</strong><p>{subject}</p></div><time>{time}</time></div>)}</div></section>
      </div>
    </section>
  </main>;
}
