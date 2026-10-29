import { permanentRedirect } from "next/navigation";

export default async function LegacyCollaborationPage({ params }: PageProps<"/artifacts/[slug]/collaborate">) {
  const { slug } = await params;
  permanentRedirect(`/artifacts/${slug}?tab=evidence`);
}
