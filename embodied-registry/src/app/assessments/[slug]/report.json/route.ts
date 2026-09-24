import { NextResponse } from "next/server";
import { getExternalPolicyAssessment, publicAssessmentRecord } from "@/lib/external-assessment";
export const dynamic = "force-static";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const record = getExternalPolicyAssessment((await params).slug);
  if (!record) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  return NextResponse.json(publicAssessmentRecord(record), { headers: { "Cache-Control": "public, max-age=0, s-maxage=86400, immutable", "Content-Disposition": `inline; filename="${record.slug}-report.json"` } });
}
