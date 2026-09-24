import type { MetadataRoute } from "next";
import { fieldNotes } from "@/lib/field-notes";
import { publicPages, siteOrigin, isPreview } from "@/lib/seo";
import { listEvaluations } from "@/lib/evaluations";
import { listExternalPolicyAssessments } from "@/lib/external-assessment-reader";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isPreview()) return [];
  const [result, assessments] = await Promise.all([
    listEvaluations({ query: "", status: "", page: 1 }),
    listExternalPolicyAssessments(),
  ]);
  const routes = publicPages.filter(path => path !== "/" || result.state === "live");
  return [
    ...routes.map(route => ({ url: `${siteOrigin}${route}` })),
    ...fieldNotes.map(note => ({ url: `${siteOrigin}/field-notes/${note.slug}` })),
    ...assessments.records.map(record => ({ url: `${siteOrigin}/assessments/${record.slug}`, lastModified: record.assessment.assessed_at })),
    // Older records remain crawlable through registry pagination and evidence links.
    ...(result.state === "live" ? result.data.records.map(record => ({ url: `${siteOrigin}/evaluations/${record.id}` })) : []),
  ];
}
