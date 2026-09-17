import { getEvaluation } from "@/lib/evaluations";
import { contributionCredits } from "@/lib/distribution";
import { manifestIssues } from "@/lib/manifest-contract";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getEvaluation(id);
  if (!("record" in result)) return Response.json({ error: result.state }, { status: result.state === "missing" ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  const issues = manifestIssues(result.record.skill.manifest, true);
  return Response.json({ format: "knownrobot-evaluation/1.0", manifest_contract: { version: "1.0", complete: issues.length === 0, issues, independently_verified: false }, illustrative: result.state === "demo", record: result.record, related: result.related, graph: result.graph, credits: result.state === "demo" ? null : contributionCredits(result.record) }, { headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="knownrobot-evaluation-${id}.json"`, "X-Content-Type-Options": "nosniff" } });
}
