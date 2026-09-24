import { NextResponse } from "next/server";
import { publicAssessmentRecord } from "@/lib/external-assessment";
import { readExternalPolicyAssessment } from "@/lib/external-assessment-reader";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const record = await readExternalPolicyAssessment((await params).slug);
  if (!record) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  return NextResponse.json(publicAssessmentRecord(record), { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400", "Content-Disposition": `inline; filename="${record.slug}-report.json"` } });
}
