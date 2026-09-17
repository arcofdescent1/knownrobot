# Connected reproduction records

The compatibility graph connects independently owned evaluation snapshots. It
does not merge ownership, rewrite reviewed evidence, pool success rates, infer
independence or confer verification status.

## Canonical identities (version 1)

- Policy: HTTPS source location, lowercase immutable Git revision, and
  `manifest.artifact_path` (empty if the repository identifies one policy).
  This is a repository-relative string, at most 1024 characters, without
  traversal segments, backslashes, whitespace or empty path segments. Malformed
  historical artifact selectors do not receive a policy identity.
  Use repository-root URLs for GitHub and Hugging Face. GitHub host/path case,
  trailing slash and `.git` aliases normalize. Other hostnames normalize case;
  arbitrary path case, query and fragment selectors are preserved. Branch/tree
  URLs are deliberately not inferred as repository-root aliases.
- Hardware: case-normalized robot family and the complete configuration object.
  Calibration, sensors, gripper or other declared changes produce a new identity.
- Protocol: case-normalized benchmark name, exact version and complete protocol.
  Changed reset, timeout, success or intervention rules produce a new identity.

Identities are SHA-256 content addresses with separate kind and version domains.
JSON object key ordering and equivalent numeric values normalize; string types
and array order remain significant. Names/descriptions, contributor identity,
runtime observations and reported outcomes are not policy identity inputs.
Missing immutable revisions or empty configuration/protocol objects do not form
usable corresponding identities. Identity reflects declarations, not independent
authentication of the source or measured physical equivalence.

## Submission, privacy and history

The existing atomic submission RPC creates each contributor's owned snapshots.
Database triggers assign graph membership in that same transaction. Shared keys
connect records without allowing one contributor to modify another's artifacts.
Draft updates refresh membership. Migration backfill derives keys from existing
records without modifying artifacts, review snapshots, result digests or IDs.
No historical evidence URLs change.

Graph reads use invoker security, row-level security and the existing public
publication view for both the anchor and connected attempts. Private, unpublished
or inaccessible anchors yield no graph. Counts and pagination include published
records only. Direct graph writes and privileged refresh functions are not
available to application roles.

## Read interface

`public_policy_attempts(p_id uuid, p_page integer = 1)` returns the anchor's
policy/hardware/protocol keys, total other published attempts, page and up to 30
records with `same_hardware` and `same_protocol` labels. Ordering is publication
time descending, then evaluation ID. Pages range from 1 to 100000. Unknown or
private anchors return null. Different configurations and protocols stay visible
as distinct attempts for the same policy revision; no statistics are pooled.

The evidence page exposes attempt pagination through `?attempts=N`.
`/evaluations/ID/graph.json?page=N` exports the identities and attempts with a
next-page URL; `/record.json` includes the first graph page. Fictional examples
cannot issue a real graph. Backend failures fail closed rather than substituting
examples or falsely claiming no connected attempts.

## Release order and verification

Apply `202609180001_compatibility_graph.sql` to the intended database before
deploying the updated web application. The migration is transactional and
backfills all existing evaluations. Run the disposable PostgreSQL verification
harness plus web tests, lint and build. The harness checks cross-contributor
connections, failed outcomes, exact configuration/protocol distinctions, draft
privacy and publication, permission denial and unchanged verification status.

Rollback the web deployment first if required. The additive graph migration can
remain installed with the previous web version; it changes no existing RPC or
artifact contract. Do not delete source records or verification history to undo
a deployment.
