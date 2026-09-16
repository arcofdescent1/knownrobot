import { listEvaluations } from "@/lib/evaluations";
import { RegistryClient } from "./registry-client";
import { parseFilters } from "@/lib/evidence-contract";
import { registryMetadata } from "@/lib/seo";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const result = await listEvaluations(parseFilters(await searchParams));
  return registryMetadata(result.filters, result.state);
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const result = await listEvaluations(parseFilters(await searchParams));
  return <RegistryClient result={result} />;
}
