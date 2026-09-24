from __future__ import annotations

import argparse
import json
import sys
import os
import tempfile
from pathlib import Path

import yaml

from . import __version__
from .inspector import inspect_policy


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="robot-skill", description="Create and validate portable robot-policy manifests.")
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    subparsers = parser.add_subparsers(dest="command", required=True)
    check = subparsers.add_parser("check", help="inspect a policy directory and report missing reproducibility evidence")
    check.add_argument("path", nargs="?", default=".", help="policy repository directory (default: current directory)")
    check.add_argument("--output", "-o", help="output path (default: POLICY/robot-skill.yaml), or '-' for manifest-only stdout")
    check.add_argument("--force", action="store_true", help="atomically replace an existing output file")
    check.add_argument("--target", help="compare against a declared target YAML/JSON profile")
    check.add_argument("--format", choices=("text", "json", "assessment"), default="text", help="diagnostic output format; assessment writes a durable JSON report")
    check.add_argument("--no-write", action="store_true", help="inspect without writing a manifest")
    check.add_argument("--strict", action="store_true", help="return exit code 2 when required evidence is missing")
    assess = subparsers.add_parser("assess-hf", help="create a provenance-bound, non-executing assessment of a Hugging Face policy")
    assess.add_argument("repository", help="Hugging Face model repository in owner/name form")
    assess.add_argument("--revision", help="full 40-character commit SHA; current HEAD is resolved and pinned when omitted")
    assess.add_argument("--output", "-o", required=True, help="new assessment-bundle directory; existing paths are never overwritten")
    assess.add_argument("--title", help="public assessment title")
    assess.add_argument("--summary", help="public assessment summary")
    assess.add_argument("--claims", help="validated JSON file of human-authored, categorized upstream model-card claim paraphrases")
    assess.add_argument("--artifact-intent", action="append", required=True,
                        choices=("task_policy", "base_policy", "training_checkpoint", "simulation_policy", "hardware_policy"),
                        help="descriptive artifact intent; repeat for multiple classifications (required)")
    assess.add_argument("--catalog", help="atomically append the record to an existing Known Robot assessment catalog")
    verify_assessment = subparsers.add_parser("verify-assessment", help="verify an external-assessment bundle, source snapshot and provenance binding")
    verify_assessment.add_argument("bundle")
    verify_report = subparsers.add_parser("verify-report", help="verify a durable validator report and its inspected policy metadata")
    verify_report.add_argument("report")
    verify_report.add_argument("--policy", required=True, help="policy directory whose inspected metadata must match the report")
    sync_assessment = subparsers.add_parser("sync-assessment", help="advance a verified assessment bundle through the append-only Supabase publication lifecycle")
    sync_assessment.add_argument("bundle")
    sync_assessment.add_argument("--lifecycle", required=True, choices=("draft", "review", "published"))
    sync_assessment.add_argument("--assessor-id", required=True, help="UUID of the accountable Known Robot assessment identity")
    sync_assessment.add_argument("--supabase-url", help="Supabase project URL; defaults to SUPABASE_URL")
    export_assessments = subparsers.add_parser("export-assessments", help="export published database assessments to an auditable source-controlled JSON catalog")
    export_assessments.add_argument("--output", "-o", required=True)
    export_assessments.add_argument("--supabase-url", help="Supabase project URL; defaults to SUPABASE_URL")
    validate = subparsers.add_parser("validate", help="validate an existing robot-skill YAML or JSON manifest")
    validate.add_argument("manifest", nargs="?", default="robot-skill.yaml")
    validate.add_argument("--format", choices=("text", "json"), default="text")
    validate.add_argument("--level", choices=("structural", "complete", "publishable"), default="complete", help="structural includes semantic checks; complete requires pinned metadata; publishable applies the shared registry publication contract")
    validate.add_argument("--target", help="compare against a declared target YAML/JSON profile")
    evaluate = subparsers.add_parser("evaluate", help="execute seeded Fetch simulation trials locally and record measured outcomes")
    evaluate.add_argument("config", help="evaluation YAML/JSON configuration")
    evaluate.add_argument("--output", required=True, help="new evidence-bundle directory; existing directories are never overwritten")
    evaluate.add_argument("--allow-execution", action="store_true", help="explicitly permit local simulator execution")
    evaluate.add_argument("--trust-policy", action="store_true", help="permit reviewed local Python policy code; not a sandbox")
    evaluate.add_argument("--evidence-url", help="HTTPS location where you will publish the bundle; enables submission.json export")
    verify = subparsers.add_parser("verify-evaluation", help="check evidence-bundle hashes and trial/trace consistency; does not establish independent verification")
    verify.add_argument("bundle")
    return parser


def _write_manifest(manifest: dict, output: str, force: bool = False) -> None:
    serialized = yaml.safe_dump(manifest, sort_keys=False, allow_unicode=True)
    if output == "-":
        sys.stdout.write(serialized)
        return
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not force:
        raise ValueError(f"Output already exists: {path}. Use --no-write to inspect or --force to replace.")
    descriptor, temporary = tempfile.mkstemp(prefix=".robot-skill-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(serialized)
            stream.flush()
            os.fsync(stream.fileno())
        if force:
            os.replace(temporary, path)
        else:
            # Atomic create-if-absent prevents concurrent writers overwriting data.
            os.link(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _print_result(result, output_format: str, stream=None) -> None:
    stream = stream or sys.stdout
    if output_format == "json":
        print(json.dumps(result.as_dict(), indent=2, allow_nan=False), file=stream)
        return
    status = "PASS" if result.complete else "INCOMPLETE"
    print(f"{status}  {result.root}", file=stream)
    print(f"Detected {len(result.detected_files)} evidence file(s); {len(result.errors)} error(s), {len(result.warnings)} warning(s).", file=stream)
    print("Local validation does not establish independent reproduction or safe physical transfer.", file=stream)
    if result.target_comparison:
        print(f"Declared target configuration: {result.target_comparison['status']}", file=stream)
    for finding in result.findings:
        marker = "ERROR" if finding.severity == "error" else "WARN "
        print(f"{marker}  {finding.path}: {finding.message} [{finding.code}]", file=stream)


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "export-assessments":
            from .database import export_published_assessments
            print(json.dumps(export_published_assessments(Path(args.output), args.supabase_url), indent=2, allow_nan=False))
            return 0
        if args.command == "sync-assessment":
            from .database import sync_assessment
            print(json.dumps(sync_assessment(Path(args.bundle), args.lifecycle, args.assessor_id, args.supabase_url), indent=2, allow_nan=False))
            return 0
        if args.command == "verify-report":
            from .report import verify_validation_report
            print(json.dumps(verify_validation_report(Path(args.report), Path(args.policy)), indent=2, allow_nan=False))
            return 0
        if args.command == "verify-assessment":
            from .assessment import verify_assessment_bundle
            print(json.dumps(verify_assessment_bundle(Path(args.bundle)), indent=2, allow_nan=False))
            return 0
        if args.command == "assess-hf":
            from .assessment import create_huggingface_assessment
            record = create_huggingface_assessment(args.repository, args.revision, Path(args.output),
                                                   title=args.title, summary=args.summary,
                                                   catalog=Path(args.catalog) if args.catalog else None,
                                                   claims=Path(args.claims) if args.claims else None,
                                                   artifact_intents=tuple(args.artifact_intent))
            print(json.dumps({"status": record["assessment"]["status"], "record_type": record["record_type"],
                              "slug": record["slug"], "source": record["source"], "binding": record["binding"],
                              "output": str(Path(args.output).expanduser().resolve()),
                              "catalog_updated": bool(args.catalog)}, indent=2, allow_nan=False))
            return 0
        if args.command == "verify-evaluation":
            from .evaluation import verify_bundle
            print(json.dumps(verify_bundle(Path(args.bundle)), indent=2))
            return 0
        if args.command == "evaluate":
            from .evaluation import evaluate
            result = evaluate(Path(args.config), Path(args.output), allow_execution=args.allow_execution,
                              trust_policy=args.trust_policy, evidence_url=args.evidence_url)
            print(json.dumps(result, indent=2, allow_nan=False))
            return 2 if result["errors"] or result["trial_count"] != result["planned_trials"] else 0
        if args.command == "validate":
            manifest_path = Path(args.manifest).expanduser().resolve()
            if not manifest_path.is_file():
                raise ValueError(f"manifest does not exist: {manifest_path}")
            from .inspector import _load_existing, _missing, source_findings
            from .model import CheckResult
            from .schema import validate_manifest
            manifest = _load_existing(manifest_path)
            result = CheckResult(manifest_path.parent, manifest, validate_manifest(manifest), [manifest_path.name])
            if result.valid and args.level == "complete":
                result.findings.extend(_missing(manifest))
                result.findings.extend(source_findings(manifest_path.parent))
            if result.valid and args.level == "publishable":
                from .publication import publication_findings
                result.findings.extend(publication_findings(manifest))
                result.findings.extend(source_findings(manifest_path.parent))
            if args.target and result.valid:
                from .compatibility import compare_target
                result.target_comparison, findings = compare_target(manifest, _load_existing(Path(args.target)))
                result.findings.extend(findings)
            _print_result(result, args.format)
            return 0 if result.complete else 2

        result = inspect_policy(Path(args.path))
        if args.target and result.valid:
            from .compatibility import compare_target
            from .inspector import _load_existing
            result.target_comparison, findings = compare_target(result.manifest, _load_existing(Path(args.target)))
            result.findings.extend(findings)
        if args.format == "assessment":
            if args.no_write:
                raise ValueError("--format assessment writes a durable report and cannot be combined with --no-write.")
            if not args.output or args.output == "-":
                raise ValueError("--format assessment requires --output with a JSON file path.")
            from .assessment import _atomic_json
            from .report import create_validation_report
            report = create_validation_report(result)
            output_path = Path(args.output).expanduser().resolve()
            if output_path.exists() and not args.force:
                raise ValueError(f"Output already exists: {output_path}. Use --force to atomically replace it.")
            _atomic_json(output_path, report, replace=args.force)
            print(json.dumps({"status": report["status"], "record_type": report["record_type"],
                              "output": str(output_path), "binding": report["binding"],
                              "summary": {"errors": len(report["findings"]["errors"]),
                                          "warnings": len(report["findings"]["warnings"])}}, indent=2))
            return 2 if not result.valid or ((args.strict or args.target) and not result.complete) else 0
        if not args.no_write and result.valid:
            output = args.output or str(result.root / "robot-skill.yaml")
            # Existing manifests are inputs, not disposable generated drafts.
            if args.output is not None or not Path(output).exists() or args.force:
                _write_manifest(result.manifest, output, args.force)
        manifest_stdout = args.output == "-" and not args.no_write
        _print_result(result, args.format, sys.stderr if manifest_stdout else sys.stdout)
        return 2 if not result.valid or ((args.strict or args.target) and not result.complete) else 0
    except (OSError, ValueError, KeyError, TypeError) as exc:
        if getattr(args, "format", "text") == "json":
            print(json.dumps({"status": "error", "message": str(exc)}), file=sys.stderr if getattr(args, "output", None) == "-" else sys.stdout)
        else:
            print(f"ERROR  {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
