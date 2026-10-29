"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { WebValidationResult } from "@/lib/web-validator-contract";

export function WebValidator() {
  const [result, setResult] = useState<WebValidationResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(""); setResult(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/validator", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source_url: form.get("source_url"), revision: form.get("revision") }) });
      const payload = await response.json() as WebValidationResult | { error?: string };
      if (!response.ok || !("findings" in payload)) throw new Error("error" in payload ? payload.error || "Validation failed." : "Validation failed.");
      setResult(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Validation failed."); }
    finally { setPending(false); }
  }

  return <section className="web-validator" aria-labelledby="web-validator-title">
    <div className="web-validator-copy"><p className="section-number">INTERACTIVE VALIDATOR</p><h2 id="web-validator-title">Paste a repository. See what is reproducible.</h2><p>KnownRobot resolves the revision, inspects an approved metadata allowlist, and explains what was found, what is missing, and what still requires human review. No account required.</p></div>
    <form onSubmit={submit} className="web-validator-form" data-analytics-event="web_validator_start">
      <label>GitHub or Hugging Face URL<input name="source_url" type="url" required inputMode="url" autoComplete="url" placeholder="https://huggingface.co/owner/policy" /></label>
      <label>Revision <span>(optional)</span><input name="revision" placeholder="Branch, tag, or commit; defaults to main" /></label>
      <button disabled={pending}>{pending ? "Inspecting approved metadata…" : "Validate repository"}</button>
      <p className="validator-boundary">Public repositories only · Metadata inspection only · No code execution</p>
    </form>
    <div aria-live="polite" aria-atomic="true">{error ? <div className="validator-error" role="alert"><strong>We could not inspect that repository.</strong><p>{error}</p><p>Check that the URL is public and points to a GitHub repository or Hugging Face model, dataset, or Space.</p></div> : null}</div>
    {result ? <div className="validator-result" aria-labelledby="validator-result-title">
      <header><div><p className="eyebrow">Pinned metadata result</p><h3 id="validator-result-title">{result.artifact.title}</h3><p><a href={result.source.revision_url} rel="noopener noreferrer">{result.source.repository} · {result.source.revision.slice(0, 12)} ↗</a></p></div><div className="validator-score"><strong>{result.summary.score}</strong><span>/ 100 metadata coverage</span></div></header>
      <div className="validator-summary"><strong>{result.summary.label}</strong><span>{result.summary.found} found</span><span>{result.summary.missing} missing</span><span>{result.summary.review} review</span></div>
      <ol className="validator-findings">{result.findings.map(finding => <li key={finding.code} className={`finding-${finding.status}`}><span className="finding-icon" aria-hidden="true">{finding.status === "found" ? "✓" : finding.status === "missing" ? "!" : "?"}</span><div><p><span>{finding.group}</span> · {finding.status}</p><h4>{finding.title}</h4><p>{finding.detail}</p>{finding.recommendation ? <p className="finding-recommendation"><strong>Next:</strong> {finding.recommendation}</p> : null}</div></li>)}</ol>
      <details><summary>{result.inspected_files.length} approved metadata file{result.inspected_files.length === 1 ? "" : "s"} inspected</summary><ul>{result.inspected_files.map(file => <li key={file.path}><code>{file.path}</code>{file.omitted ? ` — ${file.omitted}` : ""}</li>)}</ul></details>
      <p className="validator-result-boundary">{result.boundary}</p>
      <div className="validator-result-actions"><Link className="primary-link" href={`/artifacts/import?source_url=${encodeURIComponent(result.source.url)}&revision=${encodeURIComponent(result.source.revision)}`}>Import this pinned artifact →</Link><a href="https://github.com/arcofdescent1/knownrobot/blob/main/docs/validator.md">Run deeper CLI checks ↗</a></div>
    </div> : null}
  </section>;
}
