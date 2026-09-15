# Contributing to Known Robot

Known Robot is currently studying reproducibility and compatibility for low-cost LeRobot manipulation arms. The most useful contribution is a concrete account of attempting to run someone else's policy.

## Validator changes

Install the project and run its complete test suite before opening a pull request:

```bash
python -m pip install -e .
python -m unittest discover -s tests -v
```

Changes to the manifest contract must keep the packaged schema and public schema equivalent, preserve a valid complete example, and include accepted- and rejected-input tests. Breaking changes require a new schema version. The inspector must never import or execute code from a target repository and must not send telemetry.

## Participate in discovery

- Open a **problem conversation** to document a transfer attempt.
- Apply as a **founding design partner** only if you can commit an artifact, evaluation, recurring meeting, publishable result, or qualified introduction.
- Correct claims in the public field notes by opening a discussion and linking evidence.

Do not submit private datasets, credentials, confidential configurations, personal contact information, or safety-sensitive operational details to a public issue.

## Participate in a Reproduction Sprint

Apply using the current public sprint form. Selected teams commit to declare their protocol before counted trials, publish a manifest even when blocked, file failures during the run window, and permit their public evidence to appear in the joint report. Reviewers follow the [Reproduction Sprint operating handbook](community/sprints/README.md). Contributions are evaluated for evidence quality and configuration diversity, not successful outcomes.

## Evidence standard

Distinguish direct observation from inference. Include immutable source revisions when possible. Report failed reproductions as carefully as successful ones. Never describe a result as independently reproduced when the evaluator and artifact owner are the same party.

## Conduct

Be specific, generous, and technically candid. Critique claims and methods rather than people. Respect requests for anonymity in published synthesis, and do not pressure participants to disclose proprietary information.
