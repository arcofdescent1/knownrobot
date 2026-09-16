import { getEvaluation } from "@/lib/evaluations";
import { evidenceBadge } from "@/lib/distribution";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getEvaluation(id);
  const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" };
  if (!("record" in result) || result.state === "demo") return Response.json({ error: result.state === "demo" ? "illustrative_records_have_no_badges" : result.state }, { status: result.state === "missing" || result.state === "demo" ? 404 : 503, headers });
  return new Response(evidenceBadge(result.record), { headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" } });
}
