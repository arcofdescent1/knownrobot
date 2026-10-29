import { permanentRedirect } from "next/navigation";

export default async function LegacyDiscussionsPage({ params }: PageProps<"/artifacts/[slug]/discussions">) {
  const { slug } = await params;
  permanentRedirect(`/artifacts/${slug}?tab=discussions`);
}
