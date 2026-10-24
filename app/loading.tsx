export default function Loading() {
  return (
    <main
      className="mx-auto max-w-5xl p-8"
      role="status"
      aria-label="Loading page"
    >
      <div className="skeleton h-12 w-60" />
      <div className="skeleton mt-8 h-96 w-full" />
      <span className="sr-only">Loading…</span>
    </main>
  );
}
