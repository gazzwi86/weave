import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";

/** AC-7: the avatar menu's "Help" entry is a real page (not only the
 * `HelpLauncher` panel), so it survives outside the header context too. */
export default function HelpPage() {
  return (
    <main className="p-[var(--space-5)]">
      <PageHeaderSlot title="Help" subtitle="Press Cmd+K (or Ctrl+K) to search from anywhere." />
      <nav aria-label="Help topics" className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
        <a href="/ce" className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline">
          Model your company — add Processes, Actors, Goals in the Constitution
        </a>
        <a
          href="/ce/query"
          className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
        >
          Ask questions in plain language — Query the graph
        </a>
        <a
          href="/explorer"
          className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
        >
          See the whole company — Graph Explorer
        </a>
        <a
          href="/build"
          className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
        >
          Request an application generated from your model — Build
        </a>
        <a
          href="/audit"
          className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
        >
          Every change, hash-chained — Audit trail
        </a>
      </nav>
    </main>
  );
}
