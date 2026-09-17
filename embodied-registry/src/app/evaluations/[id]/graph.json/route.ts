import { getEvaluation } from "@/lib/evaluations";
import { manifestIssues } from "@/lib/manifest-contract";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const pageText = new URL(request.url).searchParams.get("page") ?? "1";
  const page = Number(pageText);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };
  if (!/^\d+$/.test(pageText) || !Number.isInteger(page) || page < 1 || page > 100000) return Response.json({ error: "Invalid page" }, { status: 400, headers });
  const { id } = await params;
  const result = await getEvaluation(id, page);
  if (!("record" in result)) return Response.json({ error: result.state }, { status: result.state === "missing" ? 404 : 503, headers });
  if (!result.graph) return Response.json({ error: "Fictional examples have no compatibility graph" }, { status: 404, headers });
  return Response.json({ format: "knownrobot-compatibility-graph/1.0", evaluation_id: id, ...result.graph,
    manifest_contract: { version: "1.0", anchor_complete: manifestIssues(result.record.skill.manifest, true).length === 0, attempts: result.graph.records.map(attempt => ({ evaluation_id: attempt.record.id, complete: manifestIssues(attempt.record.skill.manifest, true).length === 0 })) },
    next: page * 30 < result.graph.total ? `/evaluations/${id}/graph.json?page=${page + 1}` : null }, { headers });
}
