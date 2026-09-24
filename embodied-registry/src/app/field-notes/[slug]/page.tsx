import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { fieldNotes, getFieldNote } from "@/lib/field-notes";
import { pageMetadata } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

export function generateStaticParams() { return fieldNotes.map(({ slug }) => ({ slug })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const note = getFieldNote((await params).slug);
  if (!note) return { title: "Field note not found — Known Robot", robots: { index: false, follow: true } };
  return pageMetadata(`/field-notes/${note.slug}`, `${note.title} — Known Robot`, note.summary, { article: true, published: note.datePublished });
}

export default async function FieldNotePage({ params }: { params: Promise<{ slug: string }> }) {
  const note = getFieldNote((await params).slug);
  if (!note) notFound();
  const url = `https://knownrobot.com/field-notes/${note.slug}`;
  return <main><SiteHeader/><StructuredData value={[
    { "@context": "https://schema.org", "@type": "Article", headline: note.title, description: note.summary, datePublished: note.datePublished, dateModified: note.datePublished, mainEntityOfPage: url, url, image: "https://knownrobot.com/opengraph-image", author: { "@type": "Organization", name: "Known Robot", url: "https://knownrobot.com" }, publisher: { "@type": "Organization", name: "Known Robot", url: "https://knownrobot.com" } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Known Robot", item: "https://knownrobot.com" },
      { "@type": "ListItem", position: 2, name: "Field notes", item: "https://knownrobot.com/field-notes" },
      { "@type": "ListItem", position: 3, name: note.title, item: url },
    ] },
  ]}/><article className="article-page"><header><Link className="back-link" href="/field-notes">← All field notes</Link><p className="kicker">FIELD NOTE {note.number} · BASELINE DESK RESEARCH</p><h1>{note.title}</h1><p className="editorial-deck">{note.summary}</p><div className="article-meta"><span>{note.published}</span><span>{note.readTime} read</span><span>Version 1.0</span></div></header>
    <div className="article-layout"><div className="article-body">{note.sections.map((section) => <section key={section.heading}><h2>{section.heading}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}</div><aside className="source-rail"><p className="eyebrow">PRIMARY SOURCES</p>{note.sources.map((source) => <a href={source.href} key={source.href} target="_blank" rel="noreferrer">{source.label}<span>↗</span></a>)}<div className="inference-key"><strong>Interpretation policy</strong><p>Sources establish observations. Recommendations and the proposed record are Known Robot’s current inferences.</p></div></aside></div>
    <section className="article-cta"><p>Did we miss the condition that determined your result?</p><Link href="/participate">Add direct evidence →</Link></section>
  </article></main>;
}
