# Portable evidence publication contract

The portable schema (`robot_skill/robot-skill.schema.json`) and publication rules
(`robot_skill/manifest-publication.rules.json`) are the release source of truth.
Run `node scripts/sync-manifest-contract.cjs` from the repository root after
changing either file. Web tests fail if generated schema files or migration
constants drift. Shared vectors run in Python, JavaScript and PostgreSQL.

Private drafts must be structurally valid: every required section and property
must exist, but nullable metadata can remain unknown. Invalid dimensions,
impossible trial counts, unknown properties, invalid dates and conflicting exact
dependency declarations are rejected. Public publication requires nonempty
identity, framework, hardware, runtime and dataset metadata, immutable source
and dataset revisions, and named observation, action and dataset mappings.
An explicitly empty sensor array is valid for state-only simulation.

Publication accepts resolved numeric exact package pins, hash-pinned files and
immutable HTTPS dependency references. Resolve conditional requirements into the
actual target environment before publication; unresolved markers, ranges and
opaque arbitrary versions remain draft-only. This conservative publication
contract is separate from the CLI's broader `complete` inspection mode.
Use `robot-skill validate robot-skill.yaml --level publishable` to check it.

Web actions provide feedback; database triggers enforce the same structural and
publication checks for direct RPC/table writes. Publication also checks that
the manifest agrees with the declared repository, revision, framework, license
and robot family. SQL validates only the keyword subset used by the pinned
schema, not arbitrary user-supplied JSON Schemas.

Draft corrections create a new record and preserve the original private draft.
Supply the actual success count when revising: a rounded stored percentage is
insufficient to reliably reconstruct the count, so the editor does not invent it.
Historical published records and review snapshots are not rewritten. Incomplete
portable metadata is labeled on evidence pages and classified in record exports;
declaration matches alone are not complete compatibility evidence.

Schema validity and publication completeness do not prove a policy works,
certify safety, verify authorship or confer independent review status. Hardware
configuration, protocol and runtime declarations remain attributable evidence,
not automatically executed claims. Raw manifest exports retain the portable
format; record exports carry the separate completeness classification.

Release order: apply the graph migration first, then
`202609180002_manifest_contract.sql`, then deploy the matching web and CLI
release. Run `supabase/tests/run_verification.py` against a disposable PostgreSQL
17 cluster before releasing. Never run that harness against a production cluster.
