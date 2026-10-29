"use client";
import { useState } from "react";

export function EvaluationCounts() {
  const [trials, setTrials] = useState(10);
  const [successes, setSuccesses] = useState(0);
  const bounded = Math.min(successes, trials);
  const outcome = bounded === 0 ? "Failure" : bounded === trials ? "Success" : "Partial outcome";
  return <div className="evaluation-counts"><div className="form-row"><label>Total trials<input name="trial_count" type="number" min="1" max="1000000" required value={trials} onChange={event => { const next = Math.max(1, Number(event.target.value) || 1); setTrials(next); setSuccesses(current => Math.min(current, next)); }} /></label><label>Successful trials<input name="success_count" type="number" min="0" max={trials} required value={successes} onChange={event => setSuccesses(Math.min(trials, Math.max(0, Number(event.target.value) || 0)))} /></label></div><output aria-live="polite"><strong>{outcome}</strong> · {bounded}/{trials} successful trials. KnownRobot calculates the attached outcome from these counts.</output></div>;
}
