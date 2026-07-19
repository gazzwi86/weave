// Dev-only: mirror browser runtime errors to logs/dev/client-errors.jsonl (via
// /api/dev/client-errors) so the LOOPS.md squads can grep errors that happened
// while nobody had DevTools open. Compiled out of production bundles.
if (process.env.NODE_ENV !== "production") {
  let sent = 0;
  const report = (payload: Record<string, unknown>) => {
    if (sent >= 50) return; // ponytail: hard cap per page load; no queue/retry
    sent += 1;
    fetch("/api/dev/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, url: window.location.href, ts: new Date().toISOString() }),
      keepalive: true,
    }).catch(() => {});
  };
  window.addEventListener("error", (event) => {
    report({
      kind: "error",
      message: event.message,
      source: event.filename,
      line: event.lineno,
      stack: event.error instanceof Error ? event.error.stack?.slice(0, 4000) : undefined,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    report({
      kind: "unhandledrejection",
      message: (reason instanceof Error ? reason.message : String(reason)).slice(0, 2000),
      stack: reason instanceof Error ? reason.stack?.slice(0, 4000) : undefined,
    });
  });
}
