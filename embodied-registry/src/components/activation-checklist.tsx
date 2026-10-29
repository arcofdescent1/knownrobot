import Link from "next/link";
import type { buildActivationJourney } from "@/lib/activation-contract";

export function ActivationChecklist({ journey }: { journey: ReturnType<typeof buildActivationJourney> }) {
  return <section className="activation-panel" aria-labelledby="activation-title">
    <header className="activation-heading"><div><p className="eyebrow">Your first useful contribution</p><h2 id="activation-title">{journey.complete ? "You completed the contributor path." : "Build your contributor foundation."}</h2><p>{journey.complete ? "Your account is ready for repeat contribution and collaboration." : "Four durable actions take you from a new account to useful participation."}</p></div><div className="activation-score" aria-label={`${journey.completed} of ${journey.total} activation steps complete`}><strong>{journey.completed}/{journey.total}</strong><span>complete</span></div></header>
    <div className="activation-progress" role="progressbar" aria-label="Contributor activation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={journey.percent}><span style={{ width: `${journey.percent}%` }}/></div>
    <ol className="activation-steps">{journey.steps.map(step => <li key={step.id} className={step.complete ? "complete" : step.id === journey.recommended.id ? "recommended" : ""} aria-current={step.id === journey.recommended.id ? "step" : undefined}><span className="activation-marker" aria-hidden="true">{step.complete ? "✓" : step.number}</span><div><strong>{step.title}</strong><p>{step.description}</p></div><Link href={step.href}>{step.complete ? "Review" : step.action} <span>→</span></Link></li>)}</ol>
    <aside className="recommended-action"><div><span>Recommended next step</span><strong>{journey.recommended.title}</strong><p>{journey.recommended.description}</p></div><Link className="primary-link lime" href={journey.recommended.href}>{journey.recommended.action} →</Link></aside>
  </section>;
}
