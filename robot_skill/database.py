"""Administrative Supabase persistence for external policy assessments."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from .assessment import _atomic_json, verify_assessment_bundle

LIFECYCLES = ("draft", "review", "published")


def _credentials(url: str | None, *, public: bool = False) -> tuple[str, str]:
    base = (url or os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
    key_name = "SUPABASE_ANON_KEY" if public else "SUPABASE_SERVICE_ROLE_KEY"
    key = os.environ.get(key_name, "")
    if not base.startswith("https://") or not key:
        raise ValueError(f"Set a valid SUPABASE_URL and {key_name}; credentials are read from the environment only.")
    return base, key


def _request(base: str, key: str, method: str, path: str, payload: Any = None, prefer: str | None = None) -> Any:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"}
    if data is not None:
        headers["Content-Type"] = "application/json"
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(f"{base}/rest/v1/{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read()
    except urllib.error.HTTPError as exc:
        message = exc.read(4000).decode("utf-8", "replace")
        raise ValueError(f"Supabase assessment request failed ({exc.code}): {message}") from exc
    except urllib.error.URLError as exc:
        raise ValueError(f"Supabase assessment request failed: {exc.reason}") from exc
    return json.loads(body) if body else None


def _record(bundle: Path) -> dict[str, Any]:
    verify_assessment_bundle(bundle)
    try:
        record = json.loads((bundle.expanduser().resolve() / "assessment.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Could not read assessment record: {exc}") from exc
    intents = record.get("assessment", {}).get("artifact_intents")
    if not isinstance(intents, list) or not intents:
        raise ValueError("Assessment must declare at least one descriptive artifact intent before database ingestion.")
    return record


def sync_assessment(bundle: Path, lifecycle: str, assessor_id: str, url: str | None = None) -> dict[str, Any]:
    if lifecycle not in LIFECYCLES:
        raise ValueError("Lifecycle must be draft, review or published.")
    try:
        assessor = str(uuid.UUID(assessor_id))
    except (ValueError, AttributeError) as exc:
        raise ValueError("Assessor ID must be a UUID for a Known Robot assessment identity.") from exc
    record = _record(bundle)
    base, key = _credentials(url)
    source = record["source"]
    filters = urllib.parse.urlencode({
        "source_provider": f"eq.{source['provider']}",
        "source_repository": f"eq.{source['repository']}",
        "source_revision": f"eq.{source['revision']}",
        "select": "id,lifecycle,assessor_id,record",
    })
    rows = _request(base, key, "GET", f"external_policy_assessments?{filters}")
    if not isinstance(rows, list) or len(rows) > 1:
        raise ValueError("Supabase returned an invalid or non-unique assessment identity.")
    if not rows:
        if lifecycle != "draft":
            raise ValueError("A new assessment must enter as draft before review and publication.")
        created = _request(base, key, "POST", "external_policy_assessments", {
            "slug": record["slug"], "source_provider": source["provider"],
            "source_repository": source["repository"], "source_revision": source["revision"],
            "assessor_id": assessor, "lifecycle": "draft", "record": record,
        }, "return=representation")
        row = created[0]
        return {"status": "created", "id": row["id"], "lifecycle": row["lifecycle"], "slug": record["slug"]}
    row = rows[0]
    if row["assessor_id"] != assessor:
        raise ValueError("Assessment identity is already assigned to a different assessor.")
    current = row["lifecycle"]
    if current == lifecycle:
        if row["record"] != record:
            raise ValueError("Existing assessment content differs; advance the reviewed record instead of silently replacing it.")
        return {"status": "unchanged", "id": row["id"], "lifecycle": current, "slug": record["slug"]}
    expected = {"draft": "review", "review": "published"}.get(current)
    if lifecycle != expected:
        raise ValueError(f"Invalid lifecycle transition from {current} to {lifecycle}.")
    query = urllib.parse.urlencode({"id": f"eq.{row['id']}"})
    updated = _request(base, key, "PATCH", f"external_policy_assessments?{query}",
                       {"lifecycle": lifecycle, "record": record}, "return=representation")
    return {"status": "advanced", "id": updated[0]["id"], "lifecycle": updated[0]["lifecycle"], "slug": record["slug"]}


def export_published_assessments(output: Path, url: str | None = None) -> dict[str, Any]:
    base, key = _credentials(url, public=bool(os.environ.get("SUPABASE_ANON_KEY")))
    query = urllib.parse.urlencode({"lifecycle": "eq.published", "select": "record", "order": "slug.asc"})
    rows = _request(base, key, "GET", f"external_policy_assessments?{query}")
    if not isinstance(rows, list) or any(not isinstance(row, dict) or not isinstance(row.get("record"), dict) for row in rows):
        raise ValueError("Supabase returned an invalid published assessment export.")
    records = [row["record"] for row in rows]
    path = output.expanduser().resolve()
    _atomic_json(path, records)
    return {"status": "exported", "records": len(records), "output": str(path)}
