import "server-only";
import { createHash } from "node:crypto";
import type { ArtifactSource } from "./artifact-contract";

const APPROVED = ["README.md", "LICENSE", "LICENSE.md", "config.json", "policy_config.json", "preprocessor_config.json", "dataset_info.json", "robot_config.json", "pyproject.toml", "requirements.txt"];
const MAX_FILE = 256 * 1024;

async function json(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "KnownRobot-Metadata-Assessor/1.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Source API returned ${response.status}.`);
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error("Source metadata is too large.");
  return JSON.parse(text) as Record<string, unknown>;
}

async function approvedFile(url: string, path: string) {
  const response = await fetch(url, { headers: { "User-Agent": "KnownRobot-Metadata-Assessor/1.0" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not inspect ${path}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_FILE) return { path, size: bytes.length, sha256: null, omitted: "file exceeds 256 KiB inspection limit" };
  return { path, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), text: bytes.toString("utf8") };
}

function titleFrom(readme: string | undefined, fallback: string) {
  return readme?.match(/^#\s+(.+)$/m)?.[1]?.trim().slice(0, 160) || fallback;
}

export async function inspectArtifact(source: ArtifactSource, requestedRevision?: string) {
  let revision = "";
  let api: Record<string, unknown>;
  let files: Array<Record<string, unknown>> = [];
  if (source.provider === "github") {
    api = await json(`https://api.github.com/repos/${source.repository}`);
    const ref = requestedRevision || source.embeddedRevision || String(api.default_branch || "main");
    const commit = await json(`https://api.github.com/repos/${source.repository}/commits/${encodeURIComponent(ref)}`);
    revision = String(commit.sha || "");
    if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error("GitHub did not return an immutable commit.");
    files = (await Promise.all(APPROVED.map(path => approvedFile(`https://raw.githubusercontent.com/${source.repository}/${revision}/${path}`, path)))).filter(Boolean) as Array<Record<string, unknown>>;
  } else {
    const base = source.kind === "model" ? "models" : source.kind === "dataset" ? "datasets" : "spaces";
    const ref = requestedRevision || source.embeddedRevision || "main";
    api = await json(`https://huggingface.co/api/${base}/${source.repository}/revision/${encodeURIComponent(ref)}`);
    revision = String(api.sha || "");
    if (!/^[a-f0-9]{40,64}$/i.test(revision)) throw new Error("Hugging Face did not return an immutable commit.");
    const siblings = new Set((Array.isArray(api.siblings) ? api.siblings : []).map(item => String((item as { rfilename?: string }).rfilename || "")));
    files = (await Promise.all(APPROVED.filter(path => siblings.has(path)).map(path => approvedFile(`${source.url}/resolve/${revision}/${path}`, path)))).filter(Boolean) as Array<Record<string, unknown>>;
  }
  const readme = files.find(file => file.path === "README.md")?.text as string | undefined;
  const metadataFiles = files.map(file => ({ path: file.path, size: file.size, sha256: file.sha256 ?? null, ...(file.omitted ? { omitted: file.omitted } : {}) }));
  const uncertainties = [
    "KnownRobot inspected metadata only; no code, weights, dataset payloads or policy were executed.",
    "Import does not establish hardware compatibility, reproducibility, safety or measured performance.",
  ];
  if (!files.some(file => String(file.path).startsWith("LICENSE"))) uncertainties.push("No approved license file was found at this revision.");
  return {
    ...source,
    revision,
    revisionUrl: source.provider === "github" ? `${source.url}/tree/${revision}` : `${source.url}/tree/${revision}`,
    title: titleFrom(readme, source.repository.split("/")[1]),
    summary: typeof api.description === "string" ? api.description.slice(0, 2000) : "",
    license: typeof api.license === "string" ? api.license : typeof (api.cardData as Record<string, unknown> | undefined)?.license === "string" ? String((api.cardData as Record<string, unknown>).license) : "",
    metadata: { provider_response: api, inspection_boundary: "approved metadata files only" },
    inspectedFiles: metadataFiles,
    uncertainties,
  };
}

export async function inspectArtifactForValidation(source: ArtifactSource, requestedRevision?: string) {
  let revision = "";
  let api: Record<string, unknown>;
  let files: Array<Record<string, unknown>> = [];
  if (source.provider === "github") {
    api = await json(`https://api.github.com/repos/${source.repository}`);
    const ref = requestedRevision || source.embeddedRevision || String(api.default_branch || "main");
    const commit = await json(`https://api.github.com/repos/${source.repository}/commits/${encodeURIComponent(ref)}`);
    revision = String(commit.sha || "");
    if (!/^[a-f0-9]{40}$/i.test(revision)) throw new Error("GitHub did not return an immutable commit.");
    files = (await Promise.all(APPROVED.map(path => approvedFile(`https://raw.githubusercontent.com/${source.repository}/${revision}/${path}`, path)))).filter(Boolean) as Array<Record<string, unknown>>;
  } else {
    const base = source.kind === "model" ? "models" : source.kind === "dataset" ? "datasets" : "spaces";
    const ref = requestedRevision || source.embeddedRevision || "main";
    api = await json(`https://huggingface.co/api/${base}/${source.repository}/revision/${encodeURIComponent(ref)}`);
    revision = String(api.sha || "");
    if (!/^[a-f0-9]{40,64}$/i.test(revision)) throw new Error("Hugging Face did not return an immutable commit.");
    const siblings = new Set((Array.isArray(api.siblings) ? api.siblings : []).map(item => String((item as { rfilename?: string }).rfilename || "")));
    files = (await Promise.all(APPROVED.filter(path => siblings.has(path)).map(path => approvedFile(`${source.url}/resolve/${revision}/${path}`, path)))).filter(Boolean) as Array<Record<string, unknown>>;
  }
  const readme = files.find(file => file.path === "README.md")?.text as string | undefined;
  return {
    provider: source.provider,
    repository: source.repository,
    url: source.url,
    revision,
    revisionUrl: `${source.url}/tree/${revision}`,
    title: titleFrom(readme, source.repository.split("/")[1]),
    summary: typeof api.description === "string" ? api.description.slice(0, 2000) : "",
    license: typeof api.license === "string" ? api.license : typeof (api.cardData as Record<string, unknown> | undefined)?.license === "string" ? String((api.cardData as Record<string, unknown>).license) : "",
    files: files.map(file => ({ path: String(file.path), ...(typeof file.text === "string" ? { text: file.text } : {}), ...(typeof file.omitted === "string" ? { omitted: file.omitted } : {}) })),
  };
}

export async function fetchClaimProof(source: ArtifactSource, path: string) {
  let revision: string;
  if (source.provider === "github") {
    const repo = await json(`https://api.github.com/repos/${source.repository}`);
    const commit = await json(`https://api.github.com/repos/${source.repository}/commits/${encodeURIComponent(String(repo.default_branch || "main"))}`);
    revision = String(commit.sha);
  } else {
    const base = source.kind === "model" ? "models" : source.kind === "dataset" ? "datasets" : "spaces";
    const repo = await json(`https://huggingface.co/api/${base}/${source.repository}`);
    revision = String(repo.sha);
  }
  if (!/^[a-f0-9]{40,64}$/i.test(revision)) throw new Error("The upstream head could not be pinned.");
  const raw = source.provider === "github" ? `https://raw.githubusercontent.com/${source.repository}/${revision}/${path}` : `${source.url}/resolve/${revision}/${path}`;
  const file = await approvedFile(raw, path);
  if (!file || !("text" in file)) throw new Error(`Add ${path} to the upstream repository and try again.`);
  return { revision, text: String(file.text), digest: String(file.sha256), proofUrl: source.provider === "github" ? `${source.url}/blob/${revision}/${path}` : `${source.url}/blob/${revision}/${path}` };
}
