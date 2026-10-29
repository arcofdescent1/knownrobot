import Link from "next/link";

export const publicTerms = [
  { term: "Artifact", definition: "The policy, dataset, hardware, or software itself." },
  { term: "Evidence", definition: "What someone observed or measured while using an artifact." },
  { term: "Assessment", definition: "What source metadata establishes without executing the artifact." },
  { term: "Reproduction", definition: "An independent attempt to repeat a reported result." },
] as const;

export function PublicVocabulary({ compact = false }: { compact?: boolean }) {
  return <aside className={compact ? "public-vocabulary compact" : "public-vocabulary"} aria-labelledby="vocabulary-title">
    <div><p className="eyebrow">KNOWNROBOT LANGUAGE</p><h2 id="vocabulary-title">Four words organize the platform.</h2>{compact ? null : <p>Internal data may be more detailed, but every public workflow starts with these distinctions.</p>}</div>
    <dl>{publicTerms.map(({ term, definition }) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
    <Link href="/terms">See examples →</Link>
  </aside>;
}

