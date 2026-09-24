import { NextResponse } from "next/server";
import { readExternalPolicyAssessment } from "@/lib/external-assessment-reader";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const record = await readExternalPolicyAssessment((await params).slug);
  if (!record) return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
  return NextResponse.json({ record_type: record.record_type, schema_version: record.schema_version, assessment_slug: record.slug, source: record.source, assessment: record.assessment, manifest: record.manifest }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400", "Content-Disposition": `inline; filename="${record.slug}-manifest.json"` } });
}
