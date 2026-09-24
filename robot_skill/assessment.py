"""Non-executing, provenance-bound Hugging Face policy assessments."""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from . import __version__
from .inspector import _missing, inspect_policy
from .model import Finding

HF_ORIGIN = "https://huggingface.co"
COMMIT = re.compile(r"^[a-f0-9]{40}$")
REPOSITORY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,95}/[A-Za-z0-9][A-Za-z0-9_.-]{0,95}$")
MAX_FILE_BYTES = 1_000_000
MAX_TOTAL_BYTES = 8_000_000
MAX_CLAIMS_BYTES = 100_000
CLAIM_CATEGORIES = frozenset({"task", "hardware", "training", "evaluation", "limitation", "intended_use", "other"})
ARTIFACT_INTENTS = frozenset({"task_policy", "base_policy", "training_checkpoint", "simulation_policy", "hardware_policy"})
APPROVED_METADATA = frozenset({
    "README.md", "MODEL_CARD.md", "config.json", "policy_config.json", "train_config.json",
    "dataset_info.json", "meta/info.json", "configs/policy.json", "policy_preprocessor.json",
    "policy_postprocessor.json", "pyproject.toml", "requirements.txt", "environment.yml",
    "environment.yaml", "poetry.lock", "uv.lock",
})
Fetch = Callable[[str, int], bytes]


def _default_fetch(url: str, limit: int) -> bytes:
    if not url.startswith(f"{HF_ORIGIN}/"):
        raise ValueError("Assessment downloads are restricted to huggingface.co.")
    request = Request(url, headers={"Accept": "application/json, text/plain;q=0.9", "User-Agent": f"knownrobot/{__version__}"})
    try:
        with urlopen(request, timeout=20) as response:
            final_url = response.geturl()
            if not final_url.startswith(f"{HF_ORIGIN}/"):
                raise ValueError("Hugging Face metadata redirected outside the approved origin.")
            declared = response.headers.get("Content-Length")
            if declared and int(declared) > limit:
                raise ValueError(f"Remote metadata exceeds the {limit}-byte limit.")
            payload = response.read(limit + 1)
    except (HTTPError, URLError, TimeoutError) as exc:
        raise ValueError(f"Hugging Face request failed: {exc}") from exc
    if len(payload) > limit:
        raise ValueError(f"Remote metadata exceeds the {limit}-byte limit.")
    return payload


def _json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _atomic_json(path: Path, value: Any, *, replace: bool = True) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(value, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}-", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        if replace:
            os.replace(temporary, path)
        else:
            os.link(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _safe_filename(name: str) -> str:
    normalized = str(PurePosixPath(name))
    if normalized not in APPROVED_METADATA or normalized.startswith("/") or ".." in PurePosixPath(normalized).parts:
        raise ValueError(f"Unapproved metadata path: {name}")
    return normalized


def _api_model(repository: str, revision: str | None, fetch: Fetch) -> dict[str, Any]:
    if not REPOSITORY.fullmatch(repository):
        raise ValueError("Hugging Face repository must be in owner/name form.")
    if revision is not None and not COMMIT.fullmatch(revision):
        raise ValueError("--revision must be a full lowercase 40-character commit SHA.")
    encoded = "/".join(quote(part, safe="") for part in repository.split("/"))
    suffix = f"/revision/{revision}" if revision else ""
    try:
        data = json.loads(fetch(f"{HF_ORIGIN}/api/models/{encoded}{suffix}", MAX_FILE_BYTES))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ValueError("Hugging Face returned invalid model metadata.") from exc
    if not isinstance(data, dict) or not COMMIT.fullmatch(str(data.get("sha", ""))):
        raise ValueError("Hugging Face did not return an immutable model commit.")
    if revision is not None and data["sha"] != revision:
        raise ValueError("Hugging Face resolved a different commit than requested.")
    return data


def _findings_after_provenance(result, manifest: dict[str, Any]) -> list[Finding]:
    # Re-run completeness after adding verified remote provenance. Preserve structural,
    # semantic and warning findings, but replace stale local-source completeness findings.
    retained = [item for item in result.findings if item.code not in {"metadata.missing", "source.dirty", "dependency.unresolved", "evidence.absent", "compatibility.absent"}]
    return [*retained, *_missing(manifest)]


def _load_upstream_claims(path: Path | None, model_card_url: str, revision: str) -> list[dict[str, str]]:
    if path is None:
        return []
    path = path.expanduser().resolve()
    if not path.is_file() or path.stat().st_size > MAX_CLAIMS_BYTES:
        raise ValueError(f"Claims file must exist and be no larger than {MAX_CLAIMS_BYTES} bytes: {path}")
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not parse claims file: {exc}") from exc
    if not isinstance(document, dict) or set(document) != {"format", "claims"} or document.get("format") != "knownrobot-upstream-claims/1.0" or not isinstance(document.get("claims"), list):
        raise ValueError("Claims file must contain only format knownrobot-upstream-claims/1.0 and a claims array.")
    if len(document["claims"]) > 50:
        raise ValueError("Claims file contains more than 50 claims.")
    result: list[dict[str, str]] = []
    for index, item in enumerate(document["claims"]):
        if not isinstance(item, dict) or set(item) != {"category", "claim"}:
            raise ValueError(f"Claim {index} must contain only category and claim.")
        category, claim = item.get("category"), item.get("claim")
        if category not in CLAIM_CATEGORIES:
            raise ValueError(f"Claim {index} category must be one of: {', '.join(sorted(CLAIM_CATEGORIES))}.")
        if not isinstance(claim, str) or not claim.strip() or len(claim) > 1_000 or any(ord(character) < 32 and character not in "\t\n\r" for character in claim):
            raise ValueError(f"Claim {index} must be non-empty, no longer than 1000 characters and contain no control characters.")
        result.append({"category": category, "claim": claim.strip(), "source_url": model_card_url,
                       "source_revision": revision, "attribution": "Upstream model card"})
    return result


def create_huggingface_assessment(repository: str, revision: str | None, output: Path, *,
                                  title: str | None = None, summary: str | None = None,
                                  catalog: Path | None = None, claims: Path | None = None, fetch: Fetch = _default_fetch,
                                  artifact_intents: tuple[str, ...] = (),
                                  now: Callable[[], datetime] | None = None) -> dict[str, Any]:
    normalized_intents = sorted(set(artifact_intents))
    if not normalized_intents or any(intent not in ARTIFACT_INTENTS for intent in normalized_intents):
        raise ValueError(f"Declare at least one descriptive artifact intent from: {', '.join(sorted(ARTIFACT_INTENTS))}.")
    output = output.expanduser().resolve()
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    model = _api_model(repository, revision, fetch)
    commit = str(model["sha"])
    siblings = model.get("siblings")
    if not isinstance(siblings, list):
        raise ValueError("Hugging Face model metadata does not include a file inventory.")
    available = {item.get("rfilename") for item in siblings if isinstance(item, dict) and isinstance(item.get("rfilename"), str)}
    selected = sorted(APPROVED_METADATA.intersection(available))
    if not selected:
        raise ValueError("The pinned revision contains no approved metadata files.")

    parent = output.parent
    parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix=".knownrobot-assessment-", dir=parent))
    try:
        inventory: list[dict[str, Any]] = []
        total = 0
        encoded = "/".join(quote(part, safe="") for part in repository.split("/"))
        for name in selected:
            safe_name = _safe_filename(name)
            payload = fetch(f"{HF_ORIGIN}/{encoded}/resolve/{commit}/{quote(safe_name, safe='/')}", MAX_FILE_BYTES)
            total += len(payload)
            if total > MAX_TOTAL_BYTES:
                raise ValueError(f"Approved metadata exceeds the {MAX_TOTAL_BYTES}-byte aggregate limit.")
            destination = work / safe_name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(payload)
            inventory.append({"path": safe_name, "sha256": _sha256(payload), "bytes": len(payload)})

        result = inspect_policy(work)
        manifest = result.manifest
        manifest["skill"]["name"] = repository.split("/", 1)[1].replace("_", " ").replace("-", " ").strip().title()
        manifest["skill"]["source"] = {"type": "huggingface", "repository": repository, "revision": commit}
        card = model.get("cardData") if isinstance(model.get("cardData"), dict) else {}
        declared_license = card.get("license") if isinstance(card.get("license"), str) else None
        if declared_license:
            manifest["skill"]["license"] = "Apache-2.0" if declared_license.lower() == "apache-2.0" else declared_license
        findings = _findings_after_provenance(result, manifest)
        errors = [item.as_dict() for item in findings if item.severity == "error"]
        warnings = [item.as_dict() for item in findings if item.severity == "warning"]
        manifest_hash = _sha256(_json_bytes(manifest))
        inventory_hash = _sha256(_json_bytes(inventory))
        timestamp = (now or (lambda: datetime.now(timezone.utc)))().astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        author = str(model.get("author") or repository.split("/", 1)[0])
        license_name = manifest["skill"].get("license") or "Not declared upstream"
        slug = re.sub(r"[^a-z0-9]+", "-", repository.lower()).strip("-") + f"-{commit[:7]}"
        source_url = f"{HF_ORIGIN}/{repository}"
        revision_url = f"{source_url}/tree/{commit}"
        model_card_name = "README.md" if "README.md" in available else "MODEL_CARD.md"
        model_card_url = f"{source_url}/blob/{commit}/{model_card_name}"
        upstream_claims = _load_upstream_claims(claims, model_card_url, commit)
        from .report import detected_facts
        validator_facts = detected_facts(result.manifest)
        portable_declarations = [
            {"path": "skill.source.type", "value": "huggingface", "basis": "Hugging Face model API"},
            {"path": "skill.source.repository", "value": repository, "basis": "Hugging Face model API"},
            {"path": "skill.source.revision", "value": commit, "basis": "Hugging Face model API"},
            {"path": "skill.license", "value": license_name, "basis": "Hugging Face model-card metadata" if declared_license else "No upstream license declaration found"},
        ]
        claims_hash = _sha256(_json_bytes(upstream_claims))
        record = {
            "record_type": "external_policy_assessment", "schema_version": "1.0", "slug": slug,
            "title": title or f"{repository} — external metadata assessment",
            "summary": summary or "A non-executing assessment of metadata at an immutable Hugging Face model revision.",
            "source": {"provider": "huggingface", "repository": repository, "revision": commit,
                       "repository_url": source_url, "revision_url": revision_url, "model_card_url": model_card_url,
                       "author": author, "license": license_name},
            "assessment": {"method": "metadata_only", "assessor": "Known Robot", "validator_version": __version__,
                           "assessed_at": timestamp, "executed_policy_code": False, "evaluated_policy": False,
                           "established_compatibility": False, "status": "complete" if not errors else "incomplete",
                           "artifact_intents": normalized_intents,
                           "artifact_intent_notice": "Descriptive classification only; it is not a compatibility, performance, safety or deployment conclusion."},
            "binding": {"algorithm": "sha256", "manifest_sha256": manifest_hash,
                        "inventory_sha256": inventory_hash, "claims_sha256": claims_hash, "source_revision": commit},
            "manifest": manifest, "findings": {"errors": errors, "warnings": warnings},
            "inspected_files": inventory, "upstream_claims": upstream_claims,
            "evidence_classes": {"validator_detected_facts": validator_facts,
                                 "portable_manifest_declarations": portable_declarations,
                                 "upstream_attributed_claims": upstream_claims,
                                 "knownrobot_measured_results": []},
            "limitations": ["Only allowlisted repository metadata was downloaded; weights were not downloaded and policy code was not executed.",
                            "Model-card statements are not converted into Known Robot measurements or compatibility claims.",
                            "A measured evaluation requires a separate evidence record with actual trials and attributable evidence."],
        }
        bundle = work / "bundle"
        bundle.mkdir()
        source_snapshot = bundle / "source"
        for item in inventory:
            source_file = work / item["path"]
            destination = source_snapshot / item["path"]
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_file, destination)
        _atomic_json(bundle / "assessment.json", record)
        _atomic_json(bundle / "manifest.json", manifest)
        _atomic_json(bundle / "claims.json", {"format": "knownrobot-upstream-claims/1.0", "claims": upstream_claims})
        _atomic_json(bundle / "checksums.json", {"format": "knownrobot-assessment-checksums/1.0", "source_revision": commit,
                                                  "manifest_sha256": manifest_hash, "inventory_sha256": inventory_hash,
                                                  "claims_sha256": claims_hash, "files": inventory})
        os.replace(bundle, output)
        if catalog is not None:
            append_assessment_catalog(catalog.expanduser().resolve(), record)
        return record
    finally:
        shutil.rmtree(work, ignore_errors=True)


def verify_assessment_bundle(bundle: Path) -> dict[str, Any]:
    bundle = bundle.expanduser().resolve()
    if not bundle.is_dir():
        raise ValueError(f"Assessment bundle does not exist: {bundle}")
    try:
        assessment = json.loads((bundle / "assessment.json").read_text(encoding="utf-8"))
        manifest = json.loads((bundle / "manifest.json").read_text(encoding="utf-8"))
        checksums = json.loads((bundle / "checksums.json").read_text(encoding="utf-8"))
        claims_document = json.loads((bundle / "claims.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid assessment bundle: {exc}") from exc
    if not isinstance(assessment, dict) or assessment.get("record_type") != "external_policy_assessment":
        raise ValueError("Invalid external policy assessment record.")
    binding = assessment.get("binding")
    if not isinstance(binding, dict) or binding.get("algorithm") != "sha256":
        raise ValueError("Assessment does not contain a supported cryptographic binding.")
    if assessment.get("manifest") != manifest:
        raise ValueError("Assessment and standalone manifest differ.")
    if _sha256(_json_bytes(manifest)) != binding.get("manifest_sha256"):
        raise ValueError("Assessment manifest checksum mismatch.")
    inventory = assessment.get("inspected_files")
    if not isinstance(inventory, list) or _sha256(_json_bytes(inventory)) != binding.get("inventory_sha256"):
        raise ValueError("Assessment inventory checksum mismatch.")
    if checksums.get("manifest_sha256") != binding.get("manifest_sha256") or checksums.get("inventory_sha256") != binding.get("inventory_sha256") or checksums.get("files") != inventory:
        raise ValueError("Checksum inventory does not match the assessment binding.")
    claims = assessment.get("upstream_claims")
    if not isinstance(claims, list) or claims_document != {"format": "knownrobot-upstream-claims/1.0", "claims": claims}:
        raise ValueError("Attributed claims document does not match the assessment.")
    if _sha256(_json_bytes(claims)) != binding.get("claims_sha256") or checksums.get("claims_sha256") != binding.get("claims_sha256"):
        raise ValueError("Attributed claims checksum mismatch.")
    source_root = (bundle / "source").resolve()
    for item in inventory:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise ValueError("Invalid source inventory entry.")
        relative = _safe_filename(item["path"])
        source_file = (source_root / relative).resolve()
        if not source_file.is_relative_to(source_root) or not source_file.is_file():
            raise ValueError(f"Missing assessed source metadata: {relative}")
        payload = source_file.read_bytes()
        if len(payload) != item.get("bytes") or _sha256(payload) != item.get("sha256"):
            raise ValueError(f"Assessed source checksum mismatch: {relative}")
    source = assessment.get("source", {})
    if binding.get("source_revision") != source.get("revision") or not COMMIT.fullmatch(str(binding.get("source_revision", ""))):
        raise ValueError("Assessment source revision binding is invalid.")
    return {"status": "integrity_checked", "record_type": assessment["record_type"], "slug": assessment.get("slug"),
            "source_revision": binding["source_revision"], "files": len(inventory)}


def append_assessment_catalog(path: Path, record: dict[str, Any]) -> None:
    if not path.is_file():
        raise ValueError(f"Assessment catalog does not exist: {path}")
    try:
        catalog = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read assessment catalog: {exc}") from exc
    if not isinstance(catalog, list) or not all(isinstance(item, dict) for item in catalog):
        raise ValueError("Assessment catalog must be a JSON array of records.")
    identity = (record["source"]["provider"], record["source"]["repository"], record["source"]["revision"])
    if any(item.get("slug") == record["slug"] for item in catalog):
        raise ValueError(f"Assessment slug already exists in catalog: {record['slug']}")
    if any((item.get("source", {}).get("provider"), item.get("source", {}).get("repository"), item.get("source", {}).get("revision")) == identity for item in catalog):
        raise ValueError("This provider, repository and revision already exists in the catalog.")
    _atomic_json(path, [*catalog, record])
