import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "/privacy",
  "Privacy and analytics — Known Robot",
  "How KnownRobot handles public evidence, account data and optional website analytics.",
);

export default function PrivacyPage() {
  return <><SiteHeader/><main className="editorial-page">
    <header className="editorial-hero"><p className="kicker">PRIVACY</p><h1>Measure workflows, not private evidence.</h1><p className="editorial-deck">KnownRobot separates public evidence, account operations and optional site analytics.</p></header>
    <section className="editorial-section"><p className="section-number">01</p><div><h2>Optional website analytics</h2><p>With your permission, KnownRobot uses Google Analytics 4 to measure page views and high-level workflow events such as opening an assessment, validator guide, artifact-submission form, problem-conversation form or sprint application. Analytics is disabled until you choose “Allow analytics.” Your preference is stored in your browser.</p><p>KnownRobot disables Google signals and does not intentionally send names, email addresses, account form contents, policy files, private drafts or evaluation payloads to Google Analytics. Google may process device, browser, approximate location and interaction information under its own terms. Read <a href="https://policies.google.com/technologies/partner-sites">how Google uses information from sites that use its services</a>.</p></div></section>
    <section className="editorial-section"><p className="section-number">02</p><div><h2>Public evidence and accounts</h2><p>Published profiles, teams, evaluations, reviews and evidence links are intentionally public. Private drafts and authentication data are handled separately through KnownRobot’s account service. GitHub issue forms and discussions are governed by GitHub’s privacy and retention controls.</p><p>Do not submit credentials, personal contact details, confidential datasets, unpublished intellectual property, serial numbers, private facility information or safety-sensitive operational details.</p></div></section>
    <section className="editorial-section"><p className="section-number">03</p><div><h2>Change your choice</h2><p>Clear site data for knownrobot.com in your browser to reset the analytics choice. Declining analytics does not limit access to the registry, validator documentation, assessments or participation workflows.</p></div></section>
  </main></>;
}
