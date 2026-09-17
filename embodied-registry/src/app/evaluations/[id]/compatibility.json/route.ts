import { getEvaluation } from "@/lib/evaluations";
import { compatibilityAnswer } from "@/lib/compatibility-answer";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const text = new URL(request.url).searchParams.get("page") ?? "1";
  const page = Number(text);
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex" };
  if (!/^\d+$/.test(text) || !Number.isInteger(page) || page < 1 || page > 100000) return Response.json({ error: "Invalid page" }, { status: 400, headers });
  const { id } = await params;
  const result = await getEvaluation(id, page);
  if (!("record" in result)) return Response.json({ error: result.state }, { status: result.state === "missing" ? 404 : 503, headers });
  if (result.state === "demo") return Response.json({ error: "Fictional examples cannot issue compatibility answers" }, { status: 404, headers });
  return Response.json(compatibilityAnswer(result.record, result.graph), { headers });
}
