import { z } from "zod";

export const artifactTypeSchema = z.enum([
  "policy",
  "dataset",
  "hardware",
  "software",
  "benchmark",
  "repository",
]);

export type ArtifactSource = {
  provider: "github" | "huggingface";
  kind: "repository" | "model" | "dataset" | "space";
  repository: string;
  url: string;
  embeddedRevision?: string;
};

const segment = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export function parseArtifactUrl(value: string): ArtifactSource {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || url.username || url.password || url.port)
    throw new Error("Use a public HTTPS GitHub or Hugging Face URL.");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (url.hostname === "github.com") {
    if (parts.length < 2 || !segment.test(parts[0]) || !segment.test(parts[1]))
      throw new Error("Use a GitHub repository URL.");
    const repository = `${parts[0]}/${parts[1].replace(/\.git$/i, "")}`;
    const embeddedRevision = ["tree", "blob"].includes(parts[2]) ? parts[3] : undefined;
    return { provider: "github", kind: "repository", repository, url: `https://github.com/${repository}`, embeddedRevision };
  }
  if (url.hostname === "huggingface.co") {
    let kind: ArtifactSource["kind"] = "model";
    let offset = 0;
    if (parts[0] === "datasets" || parts[0] === "spaces") {
      kind = parts[0] === "datasets" ? "dataset" : "space";
      offset = 1;
    }
    if (parts.length < offset + 2 || !segment.test(parts[offset]) || !segment.test(parts[offset + 1]))
      throw new Error("Use a Hugging Face model, dataset or Space URL.");
    const repository = `${parts[offset]}/${parts[offset + 1]}`;
    const prefix = kind === "model" ? "" : `${kind === "dataset" ? "datasets" : "spaces"}/`;
    const marker = parts[offset + 2];
    const embeddedRevision = ["tree", "blob"].includes(marker) ? parts[offset + 3] : undefined;
    return { provider: "huggingface", kind, repository, url: `https://huggingface.co/${prefix}${repository}`, embeddedRevision };
  }
  throw new Error("Only github.com and huggingface.co imports are supported.");
}

export const importArtifactSchema = z.object({
  source_url: z.string().trim().min(1).transform(parseArtifactUrl),
  revision: z.string().trim().max(200).regex(/^[A-Za-z0-9._\/-]*$/).optional(),
  artifact_type: artifactTypeSchema,
});

export const correctionSchema = z.object({
  artifact_id: z.uuid(),
  title: z.string().trim().min(2).max(160),
  summary: z.string().trim().max(2000),
  license: z.string().trim().max(100),
  explanation: z.string().trim().min(20).max(2000),
  evidence_url: z.union([z.literal(""), z.url().refine(v => new URL(v).protocol === "https:")]),
});

export type ArtifactActionState = { ok: boolean; message: string; href?: string; challenge?: { id: string; token: string; path: string; content: string } };
export const initialArtifactState: ArtifactActionState = { ok: false, message: "" };
