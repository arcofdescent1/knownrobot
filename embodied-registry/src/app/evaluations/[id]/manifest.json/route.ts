import { getEvaluation } from "@/lib/evaluations";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getEvaluation(id);
  if (!("record" in result)) return Response.json({ error: result.state }, { status: result.state === "missing" ? 404 : 503, headers: { "Cache-Control": "no-store" } });
  return Response.json(result.record.skill.manifest, { headers: { "Cache-Control": "no-store", "Content-Disposition": 'attachment; filename="robot-skill.json"', "X-Content-Type-Options": "nosniff", "X-Knownrobot-Illustrative": String(result.state === "demo") } });
}
