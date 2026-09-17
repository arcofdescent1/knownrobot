"use client";
import Link from "next/link";
export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <main className="editorial-page">
      <h1>Account service temporarily unavailable.</h1>
      <p>
        Your identity or contributions have not been replaced with examples.
      </p>
      <button onClick={reset}>Try again</button>
      <p>
        <Link href="/">Browse public registry</Link>
      </p>
    </main>
  );
}
