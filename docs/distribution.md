# Distribution and portable contributor value

## Evidence, badges and credit

Live published evaluations have permanent `https://knownrobot.com/evaluations/ID` URLs exposing revisions, protocol, configuration, trial evidence, failures and attributable review history. Use that URL for repositories, reports and résumés; do not invent a DOI. The result page provides copyable evidence-linked badge Markdown and portable exports:

- `badge.svg`: current attributable status and tested robot family. It never labels the stored reported success percentage independently verified.
- `citation.json`: CSL JSON citation for the evaluation, crediting the evaluator rather than claiming policy authorship.
- `credits.json`: declared source contributors, actual registry publisher, evaluator, hardware-profile creator and all review decisions, including retractions.

`record.json` also embeds credits. Badges/citations/credit credentials are refused for fictional examples. Missing/private records return 404; outages/unconfigured backends return 503, not invented evidence. Origin responses are uncached. Image proxies can retain old badges: click through to the evidence page and update the snippet's review-version query after corrections. A badge is not universal compatibility or safety certification.

Original authors remain distinct from publishers/evaluators. Optional manifest `attribution` entries require `name`, `role` (`policy-author`, `dataset-author`, `adapter-author`, `evaluation-author`) and public HTTPS `source_url`. These are source-linked declarations, not an authorship adjudication. Missing credit is shown as missing; authors are never inferred from repository namespaces. Cite the source policy/dataset separately. Attribution changes in reviewed manifests require a new immutable record.

## Reusable validator Action

The root `action.yml` installs the trusted Action revision in an isolated Python environment, never target-policy requirements. It reads metadata without executing policy code, submitting results, posting comments or granting stronger verification. Inputs enter through environment variables and argv, not interpolated shell commands. Relative/resolved paths remain inside the declared workspace/policy directory. Artifacts are written to runner temporary storage, not the checkout.

After this code is published to the protected default branch, consumers can use:

```yaml
name: Robot evidence
on: [push, pull_request]
permissions:
  contents: read
jobs:
  evidence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: arcofdescent1/knownrobot@main
        id: evidence
        with:
          path: .
          mode: validate
          manifest: robot-skill.yaml
          level: complete
```

`mode: check` inspects with strict/no-write flags. `validate` defaults to complete; `level: structural` explicitly checks the smaller contract. `target` optionally names a declared target profile relative to `path`. No registry/API credentials are needed. Neither mode establishes independent reproduction. Diagnostics and semantically valid manifest copies are preserved before the failure gate. Outputs: `exit-code`, `report-path`, `manifest-path`. Retention is 30 days; commit canonical manifests/evidence in the contributor's own repository for durable provenance.

Pin the actual tested release commit for production consumers. The example's `@main` refers to code **after publication**; do not expect the existing v1.1.0 tag to contain this new Action. Self-hosted runners must meet upstream runtime requirements. GitHub Enterprise Server uses a different artifact environment; use the CLI there rather than claim this hosted integration works unchanged. See [official composite metadata documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax) and [official artifact behavior](https://github.com/actions/upload-artifact).

## Corrections and disputes

The result page links the dedicated correction/dispute form, related issues and `/corrections`. Maintainers acknowledge/triage publicly, appoint a named independent reviewer, disclose conflicts, request contributor response, and publish both positions, evidence, rationale and remedy. An unanswered request is pending, not rejected. Targets: acknowledge within two working days and publish a triage plan within seven; these are not fabricated completed reviews or guaranteed volunteer SLAs.

Corrected trials require a new linked immutable record. Stronger claim changes/retractions use the separately authorized `review_evaluation` RPC with review version, substantive rationale and public evidence URL; see the verification runbook. Issue comments cannot bypass authority. Close only after linking the implemented remedy or substantive no-change decision. Keep disagreement and prior reviews visible. Appeals require a different independent reviewer, prior decision link and new evidence or a procedural objection. Never delete failed outcomes or silently rewrite reviewed artifacts.

## Adapter ownership

`/adapters` and `/adapters/record.json` expose curated `embodied-registry/src/data/adapters.json`. Initially empty means **no confirmed owners yet**, not imaginary maintenance. Hardware-profile creation is not adapter ownership.

Propose ownership through the adapter-maintenance form: actual repository/full revision/license, robot/gripper/sensor and software constraints, scope, limitations, immutable contract/tests files and support/handoff issue. Maintainers inspect evidence of implementation responsibility (authored contributions, access or an explicitly owned fork). A form checkbox is not upstream ownership.

Each owner personally posts `KNOWNROBOT ADAPTER ID DIGEST` as a standalone line in a public issue comment in this repository. Draft the record, run `npm run adapters:verify` to obtain expected tokens, and replace draft zero digests with the actual expected digest/comment after confirmation. Drafts correctly fail; never merge placeholder digests. The check requires exact URL, human author and digest-bound source/scope/tests/expiry/maintainer list. Release CI is read-only and fails closed on API errors. Require maintainer PR approval and release checks on the protected branch; forms cannot mutate the directory.

Confirmations expire within 90 days and stop displaying current maintenance after expiry. Renew, disclose breaking changes, hand off or retire through public records. Changes invalidate old consent; retain history. Maintenance confirmation is not independent evaluation, accreditation or safety certification.

## Release

Apply `202609160003_public_contribution_credit.sql` only to the identified Known Robot database after earlier migrations. It extends the security-invoker public view with existing publisher/creator identity, without new write authority or changing review protection. Older backends lacking optional credit fields show missing credit honestly.

Run Python tests, web tests, ownership verification, lint/build/smoke and the disposable PostgreSQL harness. CI exercises the local reusable Action on Ubuntu/Windows/macOS. Publish reviewed code, Action revision and migrations to the intended accounts. Local tests do not mean a remote Action/tag/deployment, contributor or maintained adapter already exists.
