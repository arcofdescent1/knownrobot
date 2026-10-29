import { webValidatorRequestSchema, buildWebValidation } from "@/lib/web-validator-contract";
import { inspectArtifactForValidation } from "@/lib/artifact-importer";

export const runtime = "nodejs";

const responseHeaders = { "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 4096) return Response.json({ error: "Request is too large." }, { status: 413, headers: responseHeaders });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Send a valid JSON request." }, { status: 400, headers: responseHeaders }); }
  const parsed = webValidatorRequestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message || "Use a public GitHub or Hugging Face URL." }, { status: 400, headers: responseHeaders });
  try {
    const inspection = await inspectArtifactForValidation(parsed.data.source_url, parsed.data.revision || undefined);
    return Response.json(buildWebValidation(inspection), { headers: responseHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The source could not be inspected.";
    const status = /returned 404|not found/i.test(message) ? 404 : /returned 429/i.test(message) ? 429 : 422;
    return Response.json({ error: message }, { status, headers: responseHeaders });
  }
}
