import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { ClaimArtifactForm, CorrectionForm } from "@/components/artifact-forms";
import { readArtifact } from "@/lib/artifact-reader";
import { pageMetadata } from "@/lib/seo";
import { getSessionClient } from "@/lib/supabase/session";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const result = await readArtifact(slug);
  if (!result) return {};
  return pageMetadata(`/artifacts/${slug}`, `${result.artifact.title} — Known Robot artifact`, `Pinned upstream metadata, attribution, ownership proof and correction history for ${result.artifact.title}.`);
}
const relation = <T,>(value: T | T[] | null): T | null => Array.isArray(value) ? value[0] || null : value;
export default async function ArtifactPage({ params }: { params: Promise<{ slug: string }> }) {
  const result = await readArtifact((await params).slug);
  if (!result) notFound();
  const { artifact, revisions, claims, contributions } = result;
  const session = await getSessionClient();
  const auth = session ? await session.auth.getUser() : null;
  const user = auth?.data.user || null;
  let teams: Array<{ id: string; name: string }> = [];
  let canCorrect = false;
  if (user && session) {
    const memberships = await session.from("organization_members").select("organization_id,role,organizations(name)").eq("profile_id", user.id).in("role", ["owner", "admin"]);
    teams = (memberships.data || []).map(row => ({ id: row.organization_id, name: relation(row.organizations)?.name || "Team" }));
    const claim = claims[0];
    canCorrect = claim?.claimant_profile_id === user.id || Boolean(claim?.claimant_organization_id && teams.some(team => team.id === claim.claimant_organization_id));
  }
  const ownerProfile = relation(artifact.profiles);
  const ownerTeam = relation(artifact.organizations);
  return <><SiteHeader /><main className="editorial-page evidence-page"><p className="eyebrow">{artifact.artifact_type} · {artifact.source_provider} {artifact.source_kind}</p><h1>{artifact.title}</h1><p>{artifact.summary || "No upstream summary was available in approved metadata."}</p><dl className="artifact-facts"><dt>Canonical source</dt><dd><a href={artifact.source_url} rel="nofollow noopener noreferrer">{artifact.source_repository}</a></dd><dt>License metadata</dt><dd>{artifact.license || "Not found in approved metadata"}</dd><dt>Maintainer</dt><dd>{ownerProfile?.handle ? <Link href={`/people/${ownerProfile.handle}`}>{ownerProfile.display_name || ownerProfile.handle}</Link> : ownerTeam?.slug ? <Link href={`/teams/${ownerTeam.slug}`}>{ownerTeam.name}</Link> : "Unclaimed"}</dd></dl><aside className="boundary-note"><strong>Trust boundary:</strong> this is a metadata record, not a copy of the artifact. Ownership proof identifies an upstream maintainer; it does not verify compatibility, performance, safety, or every claim made upstream.</aside><h2>Pinned revisions</h2>{revisions.map(revision => <article key={revision.id} className="artifact-revision"><h3><a href={revision.source_revision_url} rel="nofollow noopener noreferrer"><code>{revision.source_revision}</code></a></h3><p>Inspected {revision.inspected_files.length} approved metadata file(s) on {new Date(revision.created_at).toLocaleDateString("en-US")}.</p><ul>{revision.uncertainties.map((value: string | {kind?:string;count?:number;detail?:string},index:number) => <li key={`${revision.id}-${index}`}>{typeof value==="string"?value:[value.count?`${value.count} ${value.kind?.replaceAll("_"," ")||"finding"}`:null,value.detail].filter(Boolean).join(": ")}</li>)}</ul><details><summary>Inspected file hashes</summary><pre>{JSON.stringify(revision.inspected_files, null, 2)}</pre></details></article>)}<h2>Contribution and correction history</h2>{contributions.map(item => { const person = relation(item.profiles); const team = relation(item.organizations); const publisher=relation(item.publisher); return <article key={item.id}><p><strong>{item.kind}</strong> · {new Date(item.created_at).toLocaleDateString("en-US")} · {person?.handle ? <Link href={`/people/${person.handle}`}>{person.display_name || person.handle}</Link> : publisher?.display_name || "Contributor"}{team?.slug ? <> for <Link href={`/teams/${team.slug}`}>{team.name}</Link></> : null}</p><p>{item.summary}</p>{item.evidence_url ? <p><a href={item.evidence_url} rel="nofollow noopener noreferrer">Supporting source</a></p> : null}</article>})}{!contributions.length ? <p>No contributions recorded.</p> : null}<h2>Maintainer ownership</h2>{claims[0] ? <p>Repository-backed proof verified at <a href={claims[0].proof_url} rel="nofollow noopener noreferrer"><code>{claims[0].proof_revision}</code></a> on {new Date(claims[0].verified_at).toLocaleDateString("en-US")}.</p> : user ? <ClaimArtifactForm artifactId={artifact.id} teams={teams} /> : <p><Link href="/account">Sign in and complete a profile</Link> to prove maintainership with a file committed upstream.</p>}{canCorrect ? <><h2>Correct this record</h2><p>Corrections update the current display record while preserving the prior values, reason, author, and supporting source in append-only history.</p><CorrectionForm artifact={{ id: artifact.id, title: artifact.title, summary: artifact.summary, license: artifact.license }} /></> : null}</main></>;
}
