import { getEvaluation } from "@/lib/evaluations";
import { citation } from "@/lib/distribution";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getEvaluation(id);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!("record" in result) || result.state === "demo") return Response.json({ error: result.state }, { status: result.state === "missing" || result.state === "demo" ? 404 : 503, headers });
  return Response.json([citation(result.record)], { headers: { ...headers, "Content-Disposition": `attachment; filename="knownrobot-${id}.csl.json"` } });
}
