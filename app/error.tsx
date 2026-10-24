"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="eyebrow">A little interruption</p>
      <h1 className="mt-4 text-3xl font-semibold">
        We couldn’t open this page.
      </h1>
      <p className="muted my-5">
        Please try again. If the problem continues, refresh your browser.
      </p>
      <button className="btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
