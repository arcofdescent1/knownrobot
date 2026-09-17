"""Explicit local simulation execution and portable, tamper-evident evidence."""
from __future__ import annotations

import hashlib
import importlib.metadata
import json
import os
import platform
import re
import signal
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from . import __version__
from .inspector import _load_existing
from .schema import validate_manifest

ENVIRONMENTS = ("FetchPickAndPlace-v4", "FetchReach-v4")
PACKAGES = ("gymnasium", "gymnasium-robotics", "mujoco", "numpy")


def digest_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_json(path: Path, value: dict, *, replace: bool = False) -> None:
    temporary = None
    if replace:
        descriptor, temporary = tempfile.mkstemp(prefix=".evaluation-", dir=path.parent)
        stream = os.fdopen(descriptor, "w", encoding="utf-8", newline="\n")
    else:
        stream = path.open("x", encoding="utf-8", newline="\n")
    with stream:
        json.dump(value, stream, indent=2, allow_nan=False)
        stream.write("\n")
        stream.flush()
        os.fsync(stream.fileno())
    if temporary:
        os.replace(temporary, path)


def local_file(root: Path, value: str) -> Path:
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise ValueError("Artifact paths must be relative to the evaluation configuration.")
    path = (root / value).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError(f"Artifact is missing or escapes the evaluation directory: {value}")
    return path


def integer(value, name: str, minimum: int, maximum: int) -> int:
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError(f"{name} must be an integer from {minimum} to {maximum}.")
    return value


def load_job(config_path: Path, trust_policy: bool) -> dict:
    root = config_path.resolve().parent
    config = _load_existing(config_path)
    allowed = {"format", "environment", "trials", "seed", "max_steps", "trial_timeout_seconds", "manifest", "policy"}
    if set(config) - allowed or config.get("format") != "knownrobot-evaluation/1.0":
        raise ValueError("Unknown evaluation fields or unsupported evaluation format.")
    if config.get("environment") not in ENVIRONMENTS:
        raise ValueError(f"Supported simulation environments: {', '.join(ENVIRONMENTS)}")
    integer(config.get("trials"), "trials", 1, 1000)
    seed = integer(config.get("seed"), "seed", 0, 2**32 - 1)
    if seed + config["trials"] - 1 > 2**32 - 1:
        raise ValueError("The trial seed range exceeds uint32.")
    integer(config.get("max_steps"), "max_steps", 1, 10000)
    integer(config.get("trial_timeout_seconds"), "trial_timeout_seconds", 1, 3600)
    manifest_path = local_file(root, config.get("manifest"))
    manifest = _load_existing(manifest_path)
    findings = validate_manifest(manifest)
    if findings:
        raise ValueError("Invalid policy manifest: " + "; ".join(f.message for f in findings))
    source = manifest.get("skill", {}).get("source", {})
    if not re.fullmatch(r"[a-fA-F0-9]{40,64}", source.get("revision") or ""):
        raise ValueError("Evaluation requires a full immutable policy Git revision.")
    if (manifest.get("hardware", {}).get("robot_family") or "").lower() != "fetch":
        raise ValueError("Fetch simulation requires robot_family: Fetch. SO-101 hardware claims are not interchangeable.")
    policy = config.get("policy")
    if not isinstance(policy, dict) or set(policy) != {"kind", "path", "sha256"} or policy["kind"] not in ("numpy_mlp", "python"):
        raise ValueError("policy requires kind (numpy_mlp or python), path and sha256.")
    if policy["kind"] == "python" and not trust_policy:
        raise ValueError("Python policies execute arbitrary local code. Review the policy and pass --trust-policy explicitly.")
    artifact = local_file(root, policy["path"])
    actual_digest = digest_file(artifact)
    if policy["sha256"] != actual_digest:
        raise ValueError("Policy artifact SHA-256 does not match the declared digest.")
    versions = {}
    for name in PACKAGES:
        try:
            versions[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError as exc:
            raise ValueError("Install the simulation dependencies from this checkout with pip install '.[evaluation]'.") from exc
    return {"config": config, "manifest": manifest, "artifact": str(artifact), "artifact_sha256": actual_digest,
            "manifest_sha256": digest_file(manifest_path), "config_sha256": digest_file(config_path),
            "versions": versions, "installed_packages": {distribution.metadata["Name"]: distribution.version for distribution in importlib.metadata.distributions() if distribution.metadata["Name"]},
            "runner_version": __version__}


def execute_worker(command: list[str], timeout: int) -> int:
    process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               start_new_session=os.name != "nt",
                               creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0)
    try:
        return process.wait(timeout=timeout)
    except (subprocess.TimeoutExpired, KeyboardInterrupt):
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        else:
            os.killpg(process.pid, signal.SIGKILL)
        if process.poll() is None:
            process.kill()
        process.wait()
        raise


def source_url(manifest: dict) -> str:
    source = manifest["skill"]["source"]
    repository = source.get("repository", "")
    if not repository.startswith("https://"):
        prefix = {"huggingface": "https://huggingface.co/", "github": "https://github.com/"}.get(source.get("type"))
        if not prefix:
            raise ValueError("Manifest source must identify a GitHub/Hugging Face repository or HTTPS source URL.")
        repository = prefix + repository
    parsed = urlparse(repository)
    if not parsed.hostname or parsed.username or parsed.password or re.search(r"\s", repository):
        raise ValueError("Invalid source repository URL.")
    return repository


def evaluate(config_path: Path, output: Path, *, allow_execution: bool, trust_policy: bool = False, evidence_url: str | None = None) -> dict:
    if not allow_execution:
        raise ValueError("Evaluation runs a simulator and policy locally. Pass --allow-execution; check/validate remain read-only.")
    job = load_job(config_path.resolve(), trust_policy)
    config = job["config"]
    repository_url = source_url(job["manifest"])
    if evidence_url:
        parsed = urlparse(evidence_url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or re.search(r"\s", evidence_url):
            raise ValueError("Evidence URL must be HTTPS without credentials.")
    output = output.resolve()
    output.mkdir(parents=True, exist_ok=False)
    write_json(output / "job.json", job)
    trials = []
    for index in range(config["trials"]):
        trial_path = output / f"trial-{index + 1:04d}.json"
        trace_path = output / f"trace-{index + 1:04d}.jsonl"
        command = [sys.executable, "-m", "robot_skill.evaluation_worker", "--job", str(output / "job.json"),
                   "--trial", str(index), "--result", str(trial_path), "--trace", str(trace_path)]
        try:
            returncode = execute_worker(command, config["trial_timeout_seconds"])
            if not trial_path.is_file():
                raise ValueError(f"Worker exited {returncode} without a trial result.")
            trial = _load_existing(trial_path)
            if trial.get("seed") != config["seed"] + index or type(trial.get("started")) is not bool or type(trial.get("success")) is not bool or trial.get("outcome") not in ("success", "failure", "error"):
                raise ValueError("Invalid worker trial result.")
            if returncode != 0 or digest_file(Path(job["artifact"])) != job["artifact_sha256"]:
                trial.update(success=False, outcome="error", error="Worker failure or policy artifact changed during evaluation.")
        except (subprocess.TimeoutExpired, OSError, ValueError) as exc:
            # A reset marker persists before inference, including worker timeout.
            started = False
            if trace_path.is_file():
                try:
                    with trace_path.open(encoding="utf-8") as stream:
                        reset = json.loads(stream.readline())
                    started = reset.get("reset") is True and reset.get("seed") == config["seed"] + index
                except (ValueError, OSError):
                    pass
            trial = {"seed": config["seed"] + index, "started": started, "success": False, "outcome": "error", "error": str(exc)[:2000]}
        write_json(trial_path, trial, replace=True)
        trials.append(trial)
    counted = sum(trial["started"] for trial in trials)
    successes = sum(trial["success"] and trial["outcome"] == "success" for trial in trials)
    errors = sum(trial["outcome"] == "error" for trial in trials)
    protocol = {"environment": config["environment"], "max_steps": config["max_steps"],
                "seed_start": config["seed"], "planned_trials": config["trials"],
                "reset": "Fresh process and environment; env.reset(seed=seed_start+trial_index); policy reset per trial.",
                "success_predicate": "Final simulator info.is_success equals 1 after termination/truncation or the declared step limit.",
                "intervention_policy": "No interventions or exclusions; policy/step errors after reset count as failed trials.",
                "timeout": config["trial_timeout_seconds"], "action_policy": "Finite actions within environment bounds; no implicit clipping.",
                "runner": f"knownrobot=={__version__}", "dependencies": job["versions"], "execution": "simulation"}
    report = {"format": "knownrobot-evaluation-result/1.0", "execution": "simulation", "verification_status": "self_tested",
              "independent_verification": "not_established", "created_at": datetime.now(timezone.utc).isoformat(),
              "runner_version": __version__, "platform": {"python": platform.python_version(), "system": platform.platform()},
              "config": config, "manifest": job["manifest"],
              "provenance": {key: job[key] for key in ("artifact_sha256", "manifest_sha256", "config_sha256", "versions", "installed_packages")},
              "protocol": protocol, "planned_trials": config["trials"], "trial_count": counted,
              "success_count": successes, "success_rate": 100 * successes / counted if counted else None,
              "errors": errors, "trials": trials}
    report["submission_export"] = {"created": False, "reason": "Supply --evidence-url after choosing a public evidence-bundle location."}
    if counted != config["trials"]:
        report["submission_export"]["reason"] = "Not every planned trial reset successfully; publish the blocked attempts, not a partial success claim."
    license_name = job["manifest"]["skill"].get("license")
    name = job["manifest"]["skill"].get("name")
    framework = job["manifest"]["policy"].get("framework")
    export_metadata_valid = (isinstance(name, str) and 2 <= len(name.strip()) <= 150 and
                             isinstance(license_name, str) and 1 <= len(license_name.strip()) <= 100 and
                             isinstance(framework, str) and 1 <= len(framework.strip()) <= 100)
    if evidence_url and (not isinstance(license_name, str) or not license_name.strip()):
        report["submission_export"]["reason"] = "Supply the actual policy license in the manifest before exporting a registry submission."
    if evidence_url and not export_metadata_valid:
        report["submission_export"]["reason"] = "Registry export requires an actual policy name (2–150 characters), license (1–100) and framework (1–100). No missing metadata is invented."
    from .publication import publication_findings
    publication_issues = publication_findings(job["manifest"])
    if evidence_url and publication_issues:
        report["submission_export"]["reason"] = "Portable metadata is not publishable: " + "; ".join(f"{finding.path}: {finding.message}" for finding in publication_issues)
    if counted == config["trials"] and evidence_url and export_metadata_valid and not publication_issues:
        manifest = job["manifest"]
        payload = {"name": manifest["skill"]["name"], "summary": f"Measured {config['environment']} simulation evaluation of {manifest['skill']['name']}; not physical hardware evidence.",
                   "source_url": repository_url, "source_revision": manifest["skill"]["source"]["revision"],
                   "framework": manifest["policy"]["framework"], "license": license_name,
                   "manifest": manifest, "robot_family": "Fetch", "configuration": {**manifest["hardware"], "execution": "simulation", "environment": config["environment"]},
                   "benchmark_name": f"KnownRobot {config['environment']} final-goal evaluation", "benchmark_version": "1.0",
                   "protocol": protocol, "trial_count": counted, "success_count": successes,
                   "runtime": {"execution": "simulation", "outcome": "completed_with_errors" if errors else "completed", "evaluation_result": "result.json",
                               "provenance": report["provenance"], "trial_records": trials,
                               "failures": [trial for trial in trials if not trial["success"]], "interventions": [], "exclusions": [], "deviations": []},
                   "evidence": [{"label": "Simulation evaluation evidence bundle", "url": evidence_url}], "team_id": None}
        if len(json.dumps(payload, allow_nan=False).encode("utf-8")) <= 90000:
            write_json(output / "submission.json", payload)
            report["submission_export"] = {"created": True, "reason": "Review attribution, license and evidence URL before submitting."}
        else:
            report["submission_export"]["reason"] = "Submission exceeds the registry payload limit; the full measured bundle remains available. Use a smaller predeclared cohort, never omit failed trials."
    write_json(output / "result.json", report)
    # Remove the transient worker job containing absolute local paths before
    # publishing the portable bundle. The report includes its public inputs.
    (output / "job.json").unlink()
    inventory = {path.name: digest_file(path) for path in sorted(output.iterdir()) if path.is_file()}
    write_json(output / "checksums.json", {"format": "knownrobot-evaluation-checksums/1.0", "sha256": inventory})
    return report


def verify_bundle(output: Path) -> dict:
    """Check integrity, counted trials and trace-derived final outcomes, not trust."""
    output = output.resolve()
    inventory = _load_existing(local_file(output, "checksums.json"))
    if inventory.get("format") != "knownrobot-evaluation-checksums/1.0" or not isinstance(inventory.get("sha256"), dict):
        raise ValueError("Invalid checksum inventory.")
    expected = inventory["sha256"]
    if not {"result.json"}.issubset(expected) or set(expected) != {p.name for p in output.iterdir() if p.is_file() and p.name != "checksums.json"}:
        raise ValueError("Evidence bundle is missing files or contains unlisted files.")
    for name, digest in expected.items():
        if Path(name).name != name or digest_file(local_file(output, name)) != digest:
            raise ValueError(f"Evidence checksum mismatch: {name}")
    report = _load_existing(local_file(output, "result.json"), limit=16_000_000)
    if report.get("format") != "knownrobot-evaluation-result/1.0" or report.get("execution") != "simulation" or report.get("verification_status") != "self_tested":
        raise ValueError("Invalid evaluation result or unsupported trust claim.")
    trials = report.get("trials")
    if not isinstance(trials, list) or not all(isinstance(trial, dict) for trial in trials) or not isinstance(report.get("config"), dict):
        raise ValueError("Invalid trial ledger or configuration.")
    integer(report.get("planned_trials"), "planned_trials", 1, 1000)
    integer(report["config"].get("seed"), "seed", 0, 2**32 - 1)
    if len(trials) != report.get("planned_trials"):
        raise ValueError("Planned trials were omitted.")
    for index, trial in enumerate(trials):
        if type(trial.get("started")) is not bool or type(trial.get("success")) is not bool or trial.get("outcome") not in ("success", "failure", "error"):
            raise ValueError("Invalid trial outcome.")
        if trial["success"] != (trial["outcome"] == "success") or (trial["success"] and not trial["started"]):
            raise ValueError("Success and outcome disagree.")
        if trial != _load_existing(local_file(output, f"trial-{index + 1:04d}.json")):
            raise ValueError("Trial record differs from evaluation summary.")
        if trial["seed"] != report["config"]["seed"] + index:
            raise ValueError("Trial seeds differ from the declared protocol.")
        if trial["started"]:
            trace = local_file(output, f"trace-{index + 1:04d}.jsonl")
            with trace.open(encoding="utf-8") as stream:
                reset = json.loads(stream.readline())
            if reset.get("reset") is not True or reset.get("seed") != trial["seed"]:
                raise ValueError("Started trial has no matching reset trace.")
        if trial["started"] and trial["outcome"] != "error":
            trace = local_file(output, f"trace-{index + 1:04d}.jsonl")
            with trace.open(encoding="utf-8") as stream:
                first = json.loads(stream.readline())
                last = first
                count = 0
                for line in stream:
                    last = json.loads(line)
                    count += 1
                    if last.get("step") != count:
                        raise ValueError("Trace steps are not consecutive.")
            if first.get("reset") is not True or first.get("seed") != trial["seed"] or count != trial.get("steps") or count < 1 or bool(last.get("success")) != trial["success"]:
                raise ValueError("Trial summary disagrees with its execution trace.")
            if trial["success"] != (trial["outcome"] == "success"):
                raise ValueError("Success and outcome disagree.")
    counted = sum(t["started"] for t in trials)
    successes = sum(t["success"] and t["outcome"] == "success" for t in trials)
    if report.get("trial_count") != counted or report.get("success_count") != successes or report.get("errors") != sum(t["outcome"] == "error" for t in trials):
        raise ValueError("Aggregate counts disagree with the complete trial ledger.")
    if report.get("success_rate") != (100 * successes / counted if counted else None):
        raise ValueError("Success rate disagrees with the complete trial ledger.")
    return {"status": "integrity_checked", "trial_count": counted, "success_count": successes,
            "independent_verification": "not_established", "authenticated_provenance": "not_established"}
