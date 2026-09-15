import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Participate — Known Robot", description: "Share a robot-policy transfer experience or apply as a founding Known Robot design partner." };

const repo = "https://github.com/arcofdescent1/knownrobot";

export default function ParticipatePage() {
  return <main><SiteHeader/><article className="editorial-page participate-page">
    <header className="editorial-hero"><p className="kicker">PHASE 1 · OPEN STUDY</p><h1>Help document where robot-policy transfer breaks.</h1><p className="editorial-deck">We are conducting 25 focused problem conversations before fixing the product specification. This is research—not a sales call.</p></header>
    <section className="participation-grid">
      <article className="participation-card"><span className="card-index">01</span><p className="kicker">30 MINUTES OR ASYNC</p><h2>Share a transfer attempt</h2><p>Walk through the last time you tried to reproduce someone else’s manipulation policy. Successful and failed attempts are equally useful.</p><ul><li>No product pitch</li><li>No confidential information</li><li>Public or unattributed synthesis</li><li>Continue asynchronously on GitHub</li></ul><a className="primary-link large" href={`${repo}/issues/new?template=problem-conversation.yml`}>Start a problem conversation ↗</a></article>
      <article className="participation-card dark"><span className="card-index">02</span><p className="kicker">FIVE FOUNDING TEAMS</p><h2>Become a design partner</h2><p>For practitioners ready to make one concrete six-week commitment and shape the initial reproducibility record.</p><ul><li>Supply a policy or dataset</li><li>Attempt an evaluation</li><li>Meet every two weeks</li><li>Publish agreed results</li><li>Make a qualified introduction</li></ul><a className="primary-link large lime" href={`${repo}/issues/new?template=design-partner.yml`}>Apply as a design partner ↗</a></article>
    </section>
    <section className="editorial-section"><p className="section-number">PROCESS</p><div><h2>What happens after you respond</h2><ol className="process-list"><li><strong>Scope check</strong><span>We confirm the experience involves reproducing or transferring a public manipulation policy.</span></li><li><strong>Conversation</strong><span>We reconstruct the workflow, missing information, time cost, test method, and manual work.</span></li><li><strong>Participant review</strong><span>You can correct the factual notes and choose how your experience is attributed.</span></li><li><strong>Five-conversation synthesis</strong><span>We publish patterns, contradictions, and specification changes without exposing private details.</span></li></ol></div></section>
    <section className="privacy-box"><h2>Participation and privacy</h2><p>GitHub issue forms are public. Never submit credentials, personal contact details, confidential datasets, unpublished intellectual property, serial numbers, private facility information, or safety-sensitive operational details. Participants may request that subsequent synthesis omit their name and organization. Public issue content itself remains subject to GitHub’s controls and retention.</p></section>
  </article></main>;
}
