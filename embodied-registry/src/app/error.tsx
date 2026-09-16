"use client";
import Link from "next/link";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main className="evidence-page" role="alert"><h1>This page could not be loaded</h1><p>No replacement evidence or performance claims are shown. Please try again.</p><button onClick={() => retry()}>Try again</button> · <Link href="/validator">Use the offline validator</Link></main>;
}
