"""Read dependency declarations without installing or executing anything."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

from packaging.requirements import InvalidRequirement, Requirement
from packaging.utils import canonicalize_name

try:
    import tomllib
except ImportError:  # Python 3.10
    import tomli as tomllib

import yaml

NAMES = ("pyproject.toml", "requirements.txt", "environment.yml", "environment.yaml", "poetry.lock", "uv.lock")


def pinned(requirement: str) -> bool:
    if re.fullmatch(r"file:[^\s#]+#sha256:[a-f0-9]{64}", requirement):
        return True
    try:
        parsed = Requirement(requirement)
    except InvalidRequirement:
        return False
    if parsed.url:
        return bool(re.search(r"(?:@|sha256=)(?:[a-f0-9]{40}|[a-f0-9]{64})(?:$|[&#])", parsed.url))
    specs = list(parsed.specifier)
    return len(specs) == 1 and specs[0].operator in ("==", "===") and "*" not in specs[0].version


def read_dependencies(root: Path) -> tuple[list[str], list[str]]:
    try:
        return _read_dependencies(root)
    except (TypeError, KeyError, AttributeError, IndexError) as exc:
        raise ValueError(f"Malformed dependency declaration: {exc}") from exc


def _read_dependencies(root: Path) -> tuple[list[str], list[str]]:
    declarations: list[str] = []
    files: list[str] = []
    seen: set[Path] = set()

    def read(path: Path) -> str:
        resolved = path.resolve()
        if not resolved.is_relative_to(root.resolve()):
            raise ValueError(f"Dependency include escapes policy directory: {path.name}")
        if resolved in seen:
            return ""
        seen.add(resolved)
        with resolved.open("rb") as stream:
            raw = stream.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError(f"Dependency file exceeds 1 MB: {path.name}")
        name = resolved.relative_to(root.resolve()).as_posix()
        files.append(name)
        declarations.append(f"file:{name}#sha256:{hashlib.sha256(raw).hexdigest()}")
        return raw.decode("utf-8")

    def requirements(path: Path) -> None:
        text = read(path).replace("\\\n", " ")
        for raw in text.splitlines():
            line = re.split(r"\s+#", raw, maxsplit=1)[0].strip()
            if not line or line.startswith("#"):
                continue
            include = re.fullmatch(r"(?:-r\s*|--requirement[ =]|-c\s*|--constraint[ =])(.+)", line)
            if include:
                requirements(path.parent / include.group(1).strip())
                continue
            line = re.sub(r"\s+--hash=\S+", "", line)
            if line.startswith("--"):
                # Index/options are not dependency pins or instructions to execute.
                continue
            declarations.append(line)

    for name in NAMES:
        path = root / name
        if not path.is_file():
            continue
        if name == "requirements.txt":
            requirements(path)
        elif path.suffix in (".toml", ".lock"):
            data = tomllib.loads(read(path))
            if name.endswith(".lock"):
                for package in data.get("package", []):
                    source = package.get("source", {})
                    if source.get("type") == "git" or "git" in source:
                        declarations.append(f"{package['name']} @ git+{source.get('url', source.get('git', ''))}@{source.get('resolved_reference', source.get('rev', ''))}")
                    elif package.get("version"):
                        declarations.append(f"{package['name']}=={package['version']}")
            else:
                declarations.extend(data.get("project", {}).get("dependencies", []))
                for package, spec in data.get("tool", {}).get("poetry", {}).get("dependencies", {}).items():
                    if package == "python":
                        continue
                    version = spec if isinstance(spec, str) else spec.get("version", "")
                    declarations.append(f"{package}=={version}" if re.fullmatch(r"\d+(?:\.\d+)+(?:[a-z0-9.+-]*)", version) else package)
        else:
            data = yaml.safe_load(read(path))
            if not isinstance(data, dict):
                raise ValueError(f"Invalid environment declaration: {name}")
            for item in data.get("dependencies", []):
                if isinstance(item, dict):
                    declarations.extend(item.get("pip", []))
                elif isinstance(item, str):
                    parts = item.split("=")
                    declarations.append(f"{parts[0]}=={parts[1]}" if len(parts) >= 2 and parts[1] else item)
    if any(not isinstance(item, str) for item in declarations):
        raise ValueError("Dependency declarations must be strings")
    # A lock's resolved versions supersede ranges in the project declaration.
    resolved = {}
    for item in declarations:
        if pinned(item) and not item.startswith("file:"):
            parsed = Requirement(item)
            resolved.setdefault(canonicalize_name(parsed.name), []).append(parsed)
    result = []
    for item in declarations:
        try:
            parsed = Requirement(item)
            name = canonicalize_name(parsed.name)
        except InvalidRequirement:
            name = None
        if not pinned(item) and name in resolved:
            candidates = [p for p in resolved[name] if str(p.marker) == str(parsed.marker)]
            if candidates:
                for candidate in candidates:
                    if parsed.specifier and candidate.specifier:
                        version = next(iter(candidate.specifier)).version
                        if not parsed.specifier.contains(version, prereleases=True):
                            raise ValueError(f"Dependency pin conflicts with declaration: {item} versus {candidate}")
                continue
        result.append(item)
    return sorted(set(result)), sorted(set(files))
