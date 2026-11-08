"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { registerDistributionPlacement, submitArtifactReview, submitBountyEvidence, submitClinicApplication } from "@/app/opportunities/actions";
import { initialOpportunityState, type OpportunityState } from "@/lib/opportunity-contract";

function Result({ state, draftKey }: { state: OpportunityState; draftKey?: string }) {
  useEffect(() => { if (state.ok && draftKey) sessionStorage.removeItem(draftKey); }, [state.ok, draftKey]);
  if (!state.message) return null;
  return <div role="status" className={state.ok ? "contribution-receipt" : "form-error"}>
    {state.ok ? <p className="eyebrow">CONTRIBUTION PUBLISHED</p> : null}
    <h3>{state.ok ? "You made this record more useful." : "Review the submission"}</h3><p>{state.message}</p>
    {state.ok ? <div className="receipt-actions">{state.href ? <Link className="primary-link" href={state.href}>See the published improvement →</Link> : null}{state.profileHref ? <Link href={state.profileHref}>View your public contributor profile</Link> : null}{state.recommendedHref ? <Link href={state.recommendedHref}>{state.recommendedLabel || "Continue contributing"} →</Link> : null}</div> : null}
  </div>;
}

type ReviewArtifact = { id: string; slug: string; title: string; summary: string; license: string; artifact_type: string; source_url: string };
export function ReviewSubmissionForm({ artifact, authenticated, needsProfile }: { artifact: ReviewArtifact; authenticated: boolean; needsProfile: boolean }) {
  const [state, action, pending] = useActionState(submitArtifactReview, initialOpportunityState);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const draftKey = `knownrobot:artifact-review:${artifact.id}`;
  const returnPath = `/opportunities/review/${artifact.slug}`;
  useEffect(() => {
    const raw = sessionStorage.getItem(draftKey); if (!raw || !formRef.current) return;
    try { const values = JSON.parse(raw) as Record<string, string>; for (const [name, value] of Object.entries(values)) { const field = formRef.current.elements.namedItem(name); if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = value; } }
    catch { sessionStorage.removeItem(draftKey); }
  }, [draftKey]);
  function preserveDraft() { if (!formRef.current) return; const values: Record<string, string> = {}; for (const [name, value] of new FormData(formRef.current).entries()) if (typeof value === "string" && name !== "artifact_id") values[name] = value; sessionStorage.setItem(draftKey, JSON.stringify(values)); }
  function continueToAuth(destination: "login" | "signup") { if (!formRef.current?.reportValidity()) return; preserveDraft(); router.push(`/${destination}?next=${encodeURIComponent(returnPath)}`); }
  return <form ref={formRef} action={authenticated ? action : undefined} onInput={preserveDraft} className="identity-form review-contribution-form" data-analytics-event="artifact_review_start">
    <input type="hidden" name="artifact_id" value={artifact.id} /><div className="review-time"><strong>One field · about two minutes</strong><span>Your source and rationale remain attached to the review.</span></div>
    {authenticated&&needsProfile?<fieldset className="inline-profile"><legend>Your public contributor credit</legend><p>This identity appears beside the review you publish.</p><label>Contributor name<input name="display_name" required minLength={2} maxLength={100}/></label><label>Public handle<input name="handle" required minLength={3} maxLength={39} pattern="[a-z0-9][a-z0-9-]{2,38}" placeholder="robot-builder"/></label><label className="checkbox-label"><input type="checkbox" name="public_consent" required/> Publish this name, handle, and contribution.</label></fieldset>:null}
    <label>Field reviewed<select name="field_name" defaultValue="summary"><option value="title">Title</option><option value="summary">Summary</option><option value="license">License</option><option value="artifact_type">Artifact type</option><option value="hardware">Hardware</option><option value="policy_family">Policy family</option><option value="calibration">Calibration</option><option value="evidence_status">Evidence status</option><option value="other">Other metadata</option></select></label>
    <label>Your decision<select name="decision"><option value="confirm">Confirm current value</option><option value="correct">Propose a correction</option><option value="uncertain">Flag as uncertain</option></select></label>
    <label>Confirmed or proposed value<textarea name="proposed_value" defaultValue={artifact.summary || artifact.title} minLength={2} required /></label><label>Why this is accurate<textarea name="rationale" minLength={20} required placeholder="Explain what the source establishes and what remains uncertain." /></label><label>Public supporting source<input name="source_url" type="url" defaultValue={artifact.source_url} required /></label>
    {authenticated ? <button disabled={pending}>{pending ? "Publishing review…" : "Publish attributable review"}</button> : <div className="review-auth-actions"><button type="button" onClick={() => continueToAuth("signup")}>Create account and publish</button><button className="secondary-button" type="button" onClick={() => continueToAuth("login")}>Sign in and publish</button><p>Your completed draft stays in this browser and returns after authentication.</p></div>}<Result state={state} draftKey={draftKey} />
  </form>;
}

export function ClinicSubmissionForm({ clinicId }: { clinicId: string }) { const [state, action, pending] = useActionState(submitClinicApplication, initialOpportunityState); return <form action={action} className="identity-form"><input type="hidden" name="clinic_id" value={clinicId} /><label>GitHub or Hugging Face artifact URL<input name="artifact_url" type="url" required /></label><label>What is unclear, incompatible, or failing?<textarea name="problem" minLength={20} required /></label><label>What useful record should the clinic produce?<textarea name="desired_outcome" minLength={10} required /></label><button disabled={pending}>{pending ? "Reserving seat…" : "Submit artifact for clinic"}</button><Result state={state} /></form>; }
export function BountySubmissionForm({ bountyId }: { bountyId: string }) { const [state, action, pending] = useActionState(submitBountyEvidence, initialOpportunityState); return <form action={action} className="identity-form"><input type="hidden" name="bounty_id" value={bountyId} /><label>Observed outcome<select name="outcome"><option value="success">Success</option><option value="failure">Failure</option><option value="blocked">Blocked before execution</option><option value="unsafe">Stopped for safety</option></select></label><label>Exact setup<textarea name="setup" minLength={20} required placeholder="Hardware, revision, calibration, software, and relevant configuration." /></label><label>What happened?<textarea name="observation" minLength={20} required /></label><label>Public evidence URL<input name="evidence_url" type="url" required /></label><button disabled={pending}>{pending ? "Publishing evidence…" : "Publish evidence response"}</button><Result state={state} /></form>; }
export function DistributionPlacementForm({artifactId}:{artifactId:string}){const[state,action,pending]=useActionState(registerDistributionPlacement,initialOpportunityState);return <form action={action} className="identity-form"><input type="hidden" name="artifact_id" value={artifactId}/><label>Placement type<select name="placement_type"><option value="github_readme">GitHub README</option><option value="huggingface_card">Hugging Face model or dataset card</option><option value="evidence_badge">Evidence badge</option><option value="compatibility_api">Compatibility API integration</option><option value="educator_resource">Educator resource</option><option value="collection">External collection</option></select></label><label>Public external URL<input name="placement_url" type="url" required placeholder="https://github.com/owner/repository/blob/main/README.md"/></label><button disabled={pending}>{pending?"Verifying record…":"Register external placement"}</button><Result state={state}/></form>}
