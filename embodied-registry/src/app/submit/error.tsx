"use client";
export default function SubmissionError({ reset }: { reset: () => void }) {
  return (
    <main className="editorial-page">
      <h1>Submission service temporarily unavailable.</h1>
      <p>
        Return to your account to check whether an evaluation was saved before
        retrying publication.
      </p>
      <button onClick={reset}>Try again</button>
      <p>
        <a href="/account">Your evaluations</a>
      </p>
    </main>
  );
}
