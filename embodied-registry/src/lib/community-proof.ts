import { sprintState, type Sprint } from "./sprint-contract";

/** Operating completion is not proof that anyone measured policy execution. */
export function communityProof(sprint: Sprint, now = new Date()) {
  const state = sprintState(sprint, now);
  const teams = sprint.teams.map(team => ({
    id: team.id, name: team.name, physical: team.physical,
    outcome: team.evidence?.outcome ?? null,
    trials: team.evidence?.completed ?? 0,
    measured: !!team.evidence && team.evidence.completed > 0,
    reviewed: !!team.evidence && !state.reviewPending.includes(team.id),
    evidence: team.evidence?.url ?? null,
    improvements: team.evidence?.failures.map(f => f.improvement) ?? [],
  }));
  const measured = teams.filter(team => team.measured && team.reviewed);
  const blockers = [...state.blockers];
  if (state.status !== "Completed") blockers.push("Complete the started sprint, every team outcome, independent reviews, public session and signed joint report.");
  if (measured.length < 3) blockers.push(`Collect reviewed measured trials from three distinct committed teams (${measured.length}/3). Blocked outcomes remain useful but are not measured executions.`);
  if (measured.filter(team => team.physical).length < 2) blockers.push("Collect reviewed measured trials from at least two physical-hardware teams; simulation does not prove hardware transfer.");
  return {
    format: "knownrobot-community-proof/1.0", sprint_id: sprint.id,
    established: blockers.length === 0,
    operating_status: state.status,
    confirmed_teams: teams.length, reviewed_measured_teams: measured.length,
    reviewed_measured_physical_teams: measured.filter(team => team.physical).length,
    teams, blockers, session: sprint.session?.notes ?? null, report: sprint.report?.url ?? null,
    improvement_issues: [...new Set(teams.flatMap(team => team.improvements))],
    limitations: "Repository-accepted commitments and reviews are checked by sprint:verify. Distinct team leads are not independently audited organizational independence. This is a measured community loop, not safety certification, universal transfer, registry verification or proof of successful trials.",
  };
}
