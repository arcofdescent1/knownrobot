import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { fieldNotes } from "@/lib/field-notes";

export const metadata: Metadata = { title: "Field notes — Known Robot", description: "Public, evidence-linked notes on robot-policy transfer and reproducibility." };

export default function FieldNotesPage() {
  return <main><SiteHeader/><article className="editorial-page"><header className="editorial-hero"><p className="kicker">PUBLIC RESEARCH · SERIES 01</p><h1>Field notes from the transfer gap.</h1><p className="editorial-deck">Our baseline claims are published before interviews so practitioners can challenge them. After each five conversations, we will revise the evidence, preserve material disagreements, and record what changed.</p><div className="method-note"><strong>Method</strong><span>These first three notes synthesize public documentation, issue reports, and research—not private interviews. Sources and inference are labeled.</span></div></header>
    <section className="notes-list">{fieldNotes.map((note) => <Link className="note-row" href={`/field-notes/${note.slug}`} key={note.slug}><span className="note-number">{note.number}</span><div><p>{note.published} · {note.readTime} read</p><h2>{note.title}</h2><span>{note.summary}</span></div><b>→</b></Link>)}</section>
    <section className="decision-box"><div><p className="kicker">CORRECT THE RECORD</p><h2>Have direct experience that contradicts these notes?</h2></div><a href="https://github.com/arcofdescent1/knownrobot/discussions">Join the discussion →</a></section>
  </article></main>;
}
