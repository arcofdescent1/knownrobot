import { randomUUID } from "node:crypto";
import Link from "next/link";
import { z } from "zod";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { IdentityForm } from "@/components/identity-form";
import { requireIdentity } from "@/lib/supabase/session";
import { pageMetadata } from "@/lib/seo";
import { submitEvaluation, publishDraft } from "./actions";
export const metadata = pageMetadata(
  "/submit",
  "Submit robot evidence — Known Robot",
  "Publish an attributable, self-reported robot evaluation or save a private draft.",
  { index: false },
);
export const dynamic = "force-dynamic";
export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { client, user } = await requireIdentity();
  const query = await searchParams;
  const fields = [
    "name",
    "summary",
    "source_url",
    "source_revision",
    "framework",
    "license",
    "manifest",
    "robot_family",
    "configuration",
    "benchmark_name",
    "benchmark_version",
    "protocol",
    "trial_count",
    "success_count",
    "runtime",
    "evidence",
    "team_id",
  ];
  if (query.draft) {
    if (!z.uuid().safeParse(query.draft).success) notFound();
    const { data, error } = await client
      .from("evaluations")
      .select("*,skills(*),hardware_profiles(*),benchmarks(*)")
      .eq("id", query.draft)
      .eq("submitted_by", user.id)
      .is("published_at", null)
      .maybeSingle();
    if (error) throw new Error("Draft unavailable. Try again shortly.");
    if (!data) notFound();
    return (
      <>
        <SiteHeader />
        <main className="editorial-page identity-page">
          <h1>Review your draft.</h1>
          <p>
            Publishing makes this record and all associated policy, hardware and
            protocol details public under your contributor identity. It remains
            self-reported; no independent reproduction or physical safety is
            certified.
          </p>
          <pre>{JSON.stringify(data, null, 2)}</pre>
          <IdentityForm action={publishDraft} label="Publish this draft">
            <input name="draft_id" type="hidden" value={data.id} />
            <label className="identity-consent">
              <input type="checkbox" name="consent" required />I have permission
              to publish these artifacts, accept attribution, and confirm the
              actual trial results.
            </label>
          </IdentityForm>
          <h2>Correct incomplete metadata</h2>
          <p>Save a corrected revision below. Your original private draft is preserved; the new record has its own identity and remains private unless you choose publication. Supply the actual success count: the stored rounded percentage cannot reliably reconstruct it.</p>
          <IdentityForm action={submitEvaluation} label="Save corrected revision">
            <input name="submission_id" type="hidden" value={randomUUID()} />
            <label>Evaluation JSON<textarea name="payload" required rows={24} maxLength={100000} spellCheck={false} defaultValue={JSON.stringify({
              name: data.skills.name, summary: data.skills.summary, source_url: data.skills.source_url,
              source_revision: data.skills.source_revision, framework: data.skills.framework, license: data.skills.license,
              manifest: data.skills.manifest, robot_family: data.hardware_profiles.robot_family,
              configuration: data.hardware_profiles.configuration, benchmark_name: data.benchmarks.name,
              benchmark_version: data.benchmarks.version, protocol: data.benchmarks.protocol,
              trial_count: data.trial_count, success_count: null, runtime: data.runtime,
              evidence: data.evidence, team_id: data.skills.owner_organization_id ?? null,
            }, null, 2)} /></label>
            <label>Visibility<select name="mode"><option value="draft">Private draft</option><option value="publish">Public</option></select></label>
            <label className="identity-consent"><input type="checkbox" name="consent" required />These are actual results; I have permission to share and accept attribution.</label>
          </IdentityForm>
          <Link href="/account">Back to account →</Link>
        </main>
      </>
    );
  }
  return (
    <>
      <SiteHeader />
      <main className="editorial-page identity-page">
        <h1>Submit an actual evaluation.</h1>
        <p>
          Code and datasets stay on GitHub, Hugging Face or your own HTTPS host.
          Known Robot records the evidence and your identity—not a copy of your
          checkpoint. <Link href="/account">Save your public profile</Link>{" "}
          before submitting.
        </p>
        <p>
          Use a real, immutable source revision and actual trial counts. Public
          outcomes start as self-reported. Team membership and successful
          metadata validation never grant a stronger verification status.
        </p>
        <h2>Evaluation JSON</h2>
        <p>
          Reproducing an existing policy? Use the same repository URL and immutable
          revision. Known Robot connects matching revisions automatically while
          preserving your own evidence and attribution. For multiple artifacts in
          one repository revision, put the exact repository-relative checkpoint
          location in <code>manifest.artifact_path</code>; use the same path as
          the attempt you are reproducing. Use repository-root URLs for GitHub
          and Hugging Face, not branch, tree or download URLs.
        </p>
        <p>
          Hardware identities include every declared configuration field;
          protocol identities include the benchmark name, version and full
          protocol. Reuse those exact declarations only when they accurately
          describe your attempt. Calibration, sensor or protocol changes create
          distinct configurations; results are never silently pooled.
        </p>
        <p>
          Required fields: {fields.join(", ")}. Put policy metadata in{" "}
          <code>manifest</code>; robot, gripper, sensors and calibration in{" "}
          <code>configuration</code>; reset, success predicate, intervention
          policy and timeout in <code>protocol</code>; dependencies, timing,
          outcome, failures and deviations in <code>runtime</code>. These four
          fields are JSON objects. The manifest must satisfy the portable robot-skill schema, including its required sections; unknown fields and invalid dimensions are rejected. Null metadata is allowed in private drafts. Publication additionally requires pinned source, dataset and environment metadata and named feature mappings. Evidence is an array of objects
          with <code>label</code> and an HTTPS <code>url</code>.
        </p>
        <p>
          <code>team_id</code> is null for an individual publication, or your
          existing team&apos;s UUID. The source revision must be a 40–64 digit
          hexadecimal Git revision. Success count cannot exceed trial count. At
          least one actual trial and one evidence link are required; blocked
          zero-trial attempts belong in the{" "}
          <Link href="/sprints">reproduction sprint</Link>.
        </p>
        <p>
          The local validator&apos;s manifest is one part of this evaluation, not a
          replacement for observed outcomes.{" "}
          <a href="https://github.com/arcofdescent1/knownrobot/blob/main/docs/validator.md">
            CLI documentation →
          </a>
        </p>
        <IdentityForm action={submitEvaluation} label="Save evaluation">
          <input type="hidden" name="submission_id" value={randomUUID()} />
          <label>
            Evaluation JSON
            <textarea
              name="payload"
              required
              rows={24}
              maxLength={100000}
              spellCheck={false}
            />
          </label>
          <label>
            Visibility
            <select name="mode">
              <option value="draft">
                Private draft — review before publishing
              </option>
              <option value="publish">Public — publish immediately</option>
            </select>
          </label>
          <label className="identity-consent">
            <input type="checkbox" name="consent" required />
            These are actual results; I have permission to share the artifacts
            and attribute this evaluation to my profile. Public publication is
            not independent verification.
          </label>
        </IdentityForm>
      </main>
    </>
  );
}
