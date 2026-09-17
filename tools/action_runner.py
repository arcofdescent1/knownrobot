"""GitHub composite Action runner; never imports or installs the target policy."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import uuid
import venv


def contained(root: Path, value: str) -> Path:
    if "\n" in value or "\r" in value or Path(value).is_absolute():
        raise ValueError("Action inputs must be relative paths without newlines")
    result = (root / value).resolve()
    if not result.is_relative_to(root):
        raise ValueError("Action input escapes its declared workspace or policy directory")
    return result


def validate(python: Path, workspace: Path, options: dict[str, str], reports: Path) -> tuple[int, dict]:
    policy = contained(workspace, options["path"])
    if not policy.is_dir():
        raise ValueError("Policy directory does not exist")
    mode, level = options["mode"], options["level"]
    if mode not in ("check", "validate") or level not in ("complete", "structural", "publishable"):
        raise ValueError("Unknown mode or validation level")
    command = [str(python), "-I", "-m", "robot_skill", mode]
    if mode == "check":
        command += [str(policy), "--no-write", "--strict"]
    else:
        command += [str(contained(policy, options["manifest"])), "--level", level]
    if options.get("target"):
        command += ["--target", str(contained(policy, options["target"]))]
    command += ["--format", "json"]
    process = subprocess.run(command, cwd=reports, capture_output=True, text=True, timeout=120)
    try:
        result = json.loads(process.stdout)
    except (ValueError, TypeError) as exc:
        raise ValueError("Validator did not return a JSON diagnostic record") from exc
    if not isinstance(result, dict):
        raise ValueError("Validator returned an unexpected diagnostic record")
    code = process.returncode if process.returncode in (0, 1, 2) else 1
    result["action"] = {"format": "knownrobot-action/1.0", "exit_code": code, "notice": "Local metadata validation does not establish independent reproduction or safe physical transfer."}
    # Runtime artifacts are an intentional output, never edits to the policy checkout.
    (reports / "diagnostics.json").write_text(json.dumps(result, indent=2, allow_nan=False), encoding="utf-8")
    if result.get("validation_levels", {}).get("semantically_valid") is True and isinstance(result.get("manifest"), dict):
        (reports / "robot-skill.json").write_text(json.dumps(result["manifest"], indent=2, allow_nan=False), encoding="utf-8")
    return code, result


def main() -> int:
    reports = Path(tempfile.mkdtemp(prefix="knownrobot-evidence-", dir=os.environ["RUNNER_TEMP"]))
    code = 1
    try:
        workspace = Path(os.environ["GITHUB_WORKSPACE"]).resolve()
        action = Path(os.environ["KR_ACTION_PATH"]).resolve()
        environment = reports / "runtime"
        venv.EnvBuilder(with_pip=True).create(environment)
        python = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        # Only install the trusted Action revision, never a requirements file from the policy.
        subprocess.run([str(python), "-I", "-m", "pip", "--isolated", "install", "--disable-pip-version-check", str(action)], check=True, timeout=300, stdout=subprocess.DEVNULL)
        output = reports / "evidence"
        output.mkdir()
        options = {key: os.environ.get(f"KR_{name}", default) for key, name, default in [("path", "POLICY_PATH", "."), ("mode", "MODE", "validate"), ("manifest", "MANIFEST", "robot-skill.yaml"), ("target", "TARGET", ""), ("level", "LEVEL", "complete")]}
        code, _ = validate(python, workspace, options, output)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        output = reports / "evidence"
        output.mkdir(exist_ok=True)
        (output / "diagnostics.json").write_text(json.dumps({"status": "error", "message": str(exc), "action": {"exit_code": 1}}), encoding="utf-8")
    with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as stream:
        stream.write(f"exit-code={code}\nreport-path={output / 'diagnostics.json'}\nreport-directory={output}\nmanifest-path={output / 'robot-skill.json' if (output / 'robot-skill.json').exists() else ''}\nartifact-id={uuid.uuid4().hex}\n")
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
        stream.write(f"## Known Robot evidence\n\nValidator exit code: **{code}**. Download the attached diagnostics and manifest.\n\nLocal validation does **not** establish independent reproduction or safe physical transfer. No policy code was executed and no registry claim was submitted.\n")
    # Artifact preservation precedes the composite's final gate step.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
