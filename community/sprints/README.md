# Reproduction Sprint operating handbook

Known Robot runs one two-week public reproduction study each month. Every sprint uses one immutable policy revision, a declared task, three to five materially different hardware configurations, and a joint report that includes failures.

## Roles

- **Event lead:** freezes the artifact, publishes dates, facilitates kickoff and results, and owns the joint report.
- **Evidence reviewer:** checks manifests, denominators, protocol deviations, and public links without changing participant conclusions.
- **Team lead:** owns hardware safety, submits one manifest and evidence issue, and responds to clarification requests.
- **Adapter maintainer:** reviews changes that translate observation or action contracts; this role may be held by a team lead.

The event lead and evidence reviewer must be named in the sprint brief before applications open. A policy author may participate but may not be the sole evidence reviewer.

## Monthly gates

1. **Selection:** choose a public artifact with an immutable revision, a feasible low-cost embodiment, and a testable task.
2. **Recruitment:** accept three to five teams based on configuration diversity and ability to publish evidence—not on expected success.
3. **Kickoff:** freeze the protocol and document open questions. Any later change is versioned and disclosed.
4. **Execution:** teams file a public evidence issue as soon as they finish or become blocked. Failures are not held until the end.
5. **Review:** the reviewer checks arithmetic, artifact identity, declared configuration, intervention counts, and evidence links.
6. **Results:** hold a public session, record corrections, and distinguish completed, failed, blocked, and unsafe-to-continue attempts.
7. **Publication:** merge a joint report within seven days and open product issues for every repeated compatibility failure.

## Evidence rules

- Counts include every trial begun under the declared protocol.
- Exclusions, resets, human interventions, and protocol changes are explicit.
- Success percentages are derived from success and trial counts.
- “Reproduced” requires a team independent of the policy publisher.
- A blocked or unsafe attempt is a publishable result.
- Videos illustrate behavior but do not replace manifests, counts, or logs.
- Private data, credentials, device serial numbers, facility layouts, and exploitable safety details stay private.

## Safety boundary

Known Robot does not certify a policy or direct hardware operation. Each team controls its equipment, risk assessment, workspace, emergency stop, and supervision. Initial sprints exclude people from the robot operating envelope, prohibit safety-control bypasses, and stop when unexpected motion or a configuration mismatch creates doubt.

## Corrections and disputes

Participants may request a factual correction by commenting on the evidence issue or report pull request. The event lead records substantive post-publication changes in the report’s correction log. Disagreement about interpretation remains visible and attributed; raw results are not deleted merely because a reproduction failed.
