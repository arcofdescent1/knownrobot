"use client";

import { useActionState, useState } from "react";
import { submitSprintApplication } from "@/app/sprints/actions";
import { initialSprintApplicationState } from "@/lib/sprint-application-contract";

export function SprintApplicationForm({ sprintId }: { sprintId: string }) {
  const [state, action, pending] = useActionState(submitSprintApplication, initialSprintApplicationState);
  const [role, setRole] = useState("team");
  return <form action={action} className="identity-form sprint-application-form" data-analytics-event="sprint_application_submit">
    <input type="hidden" name="sprint_id" value={sprintId} />
    <label>How will you participate?
      <select name="role" value={role} onChange={(event) => setRole(event.target.value)}>
        <option value="team">Run a reproduction</option>
        <option value="reviewer">Review another team&apos;s evidence</option>
        <option value="event_lead">Coordinate the sprint</option>
      </select>
    </label>
    {role === "team" ? <label>Team or lab name<input name="team_name" required maxLength={120} placeholder="Independent builders is fine" /></label> : <input type="hidden" name="team_name" value="" />}
    <label>Execution environment
      <select name="environment" defaultValue="physical">
        <option value="physical">Physical hardware</option>
        <option value="simulation">Simulation</option>
        <option value="both">Physical hardware and simulation</option>
      </select>
    </label>
    <label>Your configuration and relevant experience
      <textarea name="configuration" required minLength={20} maxLength={1500} rows={5} placeholder="Robot, gripper, cameras, compute, LeRobot experience, and what you can contribute." />
    </label>
    <label>Public configuration or evidence link <span>(optional)</span>
      <input name="evidence_url" type="url" inputMode="url" placeholder="https://github.com/… or https://huggingface.co/…" />
    </label>
    <label>Availability and constraints
      <textarea name="availability" required minLength={10} maxLength={1000} rows={3} placeholder="Time zone, hours available, hardware access dates, or review constraints." />
    </label>
    <label className="checkbox-label"><input type="checkbox" name="commitment" required /> I can complete the two-week role commitment and publish useful outcomes, including failures or blocked attempts.</label>
    <label className="checkbox-label"><input type="checkbox" name="attribution_consent" required /> If accepted, KnownRobot may publish my contributor profile and declared configuration in the roster. My email remains private.</label>
    <button disabled={pending}>{pending ? "Submitting application…" : "Apply to the reproduction sprint"}</button>
    {state.message ? <div className={state.ok ? "form-success" : "form-error"} role="status"><p>{state.message}</p></div> : null}
  </form>;
}

