import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ArtifactWorkspace, type ArtifactTab } from "@/components/artifact-workspace";
import { readArtifact } from "@/lib/artifact-reader";
import { listArtifactThreads } from "@/lib/community-reader";
import { pageMetadata } from "@/lib/seo";
import { getSessionClient } from "@/lib/supabase/session";
import { getServiceSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const validTabs = new Set<ArtifactTab>(["overview", "evidence", "discussions", "reproductions", "history", "distribution"]);
const relation = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] || null : value;

export async function generateMetadata({ params }: PageProps<"/artifacts/[slug]">) {
  const slug = (await params).slug;
  const result = await readArtifact(slug);
  if (!result) return {};
  return pageMetadata(`/artifacts/${slug}`, `${result.artifact.title} — Known Robot artifact`, `Evidence, discussions, reproductions, history and distribution tools for ${result.artifact.title}.`);
}

export default async function ArtifactPage({ params, searchParams }: PageProps<"/artifacts/[slug]">) {
  const { slug } = await params;
  const [result, session] = await Promise.all([readArtifact(slug), getSessionClient()]);
  if (!result) notFound();
  const query = await searchParams;
  const requestedTab = typeof query.tab === "string" ? query.tab : "overview";
  const tab: ArtifactTab = validTabs.has(requestedTab as ArtifactTab) ? requestedTab as ArtifactTab : "overview";
  const [threads, auth] = await Promise.all([listArtifactThreads(result.artifact.id), session ? session.auth.getUser() : Promise.resolve(null)]);
  const user = auth && "data" in auth ? auth.data.user : null;
  let teams: Array<{ id: string; name: string }> = [];
  let collections: Array<{ id: string; title: string }> = [];
  let publishedEvaluations: Array<{ id: string; name: string; robotFamily: string; trialCount: number; successRate: number }> = [];
  let following = false;
  let canCorrect = false;
  let canManage = result.artifact.imported_by === user?.id;
  if (user) {
    const service = getServiceSupabaseClient();
    if (service) {
      const [memberships, profileCollections, follow, evaluations] = await Promise.all([
        service.from("organization_members").select("organization_id,role,organizations(name)").eq("profile_id", user.id).in("role", ["owner", "admin"]),
        service.from("collections").select("id,title").eq("owner_profile_id", user.id).order("title"),
        service.from("follows").select("id").eq("follower_id", user.id).eq("artifact_id", result.artifact.id).maybeSingle(),
        service.from("evaluations").select("id,trial_count,success_rate,skills(name),hardware_profiles(robot_family)").eq("submitted_by", user.id).not("published_at", "is", null).order("published_at", { ascending: false }).limit(100),
      ]);
      teams = (memberships.data || []).map(row => ({ id: row.organization_id, name: relation(row.organizations)?.name || "Team" }));
      const teamIds = teams.map(team => team.id);
      const teamCollections = teamIds.length ? await service.from("collections").select("id,title").in("owner_organization_id", teamIds).order("title") : { data: [] };
      const collectionMap = new Map<string, { id: string; title: string }>();
      for (const collection of [...(profileCollections.data || []), ...(teamCollections.data || [])]) collectionMap.set(collection.id, collection);
      collections = [...collectionMap.values()];
      following = Boolean(follow.data);
      publishedEvaluations = (evaluations.data || []).map(evaluation => ({ id: evaluation.id, name: relation(evaluation.skills)?.name || "Untitled evaluation", robotFamily: relation(evaluation.hardware_profiles)?.robot_family || "Hardware unspecified", trialCount: evaluation.trial_count, successRate: Number(evaluation.success_rate) }));
      const claim = result.claims[0];
      canCorrect = claim?.claimant_profile_id === user.id || Boolean(claim?.claimant_organization_id && teams.some(team => team.id === claim.claimant_organization_id));
      canManage ||= canCorrect;
    }
  }
  return <><SiteHeader /><main className="artifact-workspace"><ArtifactWorkspace artifact={result.artifact} tab={tab} userId={user?.id} following={following} canManage={canManage} canCorrect={canCorrect} teams={teams} collections={collections} publishedEvaluations={publishedEvaluations} claims={result.claims} revisions={result.revisions} contributions={result.contributions} attempts={result.attempts} relations={result.relations} threads={threads} /></main></>;
}
