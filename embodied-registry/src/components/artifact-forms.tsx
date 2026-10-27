"use client";
import Link from "next/link";
import { useActionState } from "react";
import { importArtifact, requestArtifactClaim, verifyArtifactClaim, correctArtifact } from "@/app/artifacts/actions";
import { initialArtifactState } from "@/lib/artifact-contract";

function Result({ state }: { state: typeof initialArtifactState & { href?: string; challenge?: { id: string; token: string; path: string; content: string } } }) {
  if (!state.message) return null;
  return <div className={state.ok ? "form-success" : "form-error"} role="status"><p>{state.message}</p>{state.href ? <p><Link href={state.href}>Open canonical record →</Link></p> : null}{state.challenge ? <div><p><strong>{state.challenge.path}</strong></p><pre>{state.challenge.content}</pre><p>Challenge ID: <code>{state.challenge.id}</code></p><p>Token: <code>{state.challenge.token}</code></p></div> : null}</div>;
}
export function ImportArtifactForm() {
  const [state, action, pending] = useActionState(importArtifact, initialArtifactState);
  return <form action={action} className="identity-form"><label>GitHub or Hugging Face URL<input name="source_url" type="url" required placeholder="https://huggingface.co/owner/policy" /></label><label>Revision (branch, tag or commit)<input name="revision" placeholder="main (resolved to an immutable commit)" /></label><label>Descriptive artifact type<select name="artifact_type" defaultValue="policy"><option value="policy">Policy</option><option value="dataset">Dataset</option><option value="hardware">Hardware</option><option value="software">Software</option><option value="benchmark">Benchmark</option><option value="repository">Repository</option></select></label><button disabled={pending}>{pending ? "Inspecting metadata…" : "Import pinned artifact"}</button><Result state={state} /></form>;
}
export function ClaimArtifactForm({ artifactId, teams }: { artifactId: string; teams: Array<{ id: string; name: string }> }) {
  const [request, requestAction, requesting] = useActionState(requestArtifactClaim, initialArtifactState);
  const [verify, verifyAction, verifying] = useActionState(verifyArtifactClaim, initialArtifactState);
  return <div className="identity-grid"><form action={requestAction} className="identity-form"><h3>1. Create ownership challenge</h3><input type="hidden" name="artifact_id" value={artifactId} /><label>Claim as<select name="organization_id"><option value="">My individual profile</option>{teams.map(team => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label><button disabled={requesting}>{requesting ? "Creating…" : "Create challenge"}</button><Result state={request} /></form><form action={verifyAction} className="identity-form"><h3>2. Verify committed proof</h3><label>Challenge ID<input name="challenge_id" required /></label><label>Secret token<input name="token" required /></label><button disabled={verifying}>{verifying ? "Checking upstream…" : "Verify repository proof"}</button><Result state={verify} /></form></div>;
}
export function CorrectionForm({ artifact }: { artifact: { id: string; title: string; summary: string; license: string } }) {
  const [state, action, pending] = useActionState(correctArtifact, initialArtifactState);
  return <form action={action} className="identity-form"><input type="hidden" name="artifact_id" value={artifact.id} /><label>Title<input name="title" defaultValue={artifact.title} required /></label><label>Summary<textarea name="summary" defaultValue={artifact.summary} /></label><label>License identifier<input name="license" defaultValue={artifact.license} /></label><label>Reason for correction<textarea name="explanation" minLength={20} required /></label><label>Supporting source (optional)<input name="evidence_url" type="url" /></label><button disabled={pending}>{pending ? "Publishing…" : "Publish attributable correction"}</button><Result state={state} /></form>;
}
