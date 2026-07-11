"use client";

import { Component, type ReactNode } from "react";

import { Card, CardContent, CardTitle } from "@/components/ui/card";

function TileErrorBody({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-start gap-[var(--space-2)]">
      <p className="text-[var(--color-text-muted)]">Couldn&apos;t load this tile.</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)]"
      >
        Retry
      </button>
    </div>
  );
}

interface BoundaryState {
  hasError: boolean;
}

/** AC-2 defence-in-depth: `useTile`'s fetch-level error state covers
 * network/HTTP failures; this native class boundary additionally catches
 * a render-time exception inside one tile's content without blanking the
 * other five (ladder rung 4 -- native platform feature, no new dependency).
 */
class TileBoundary extends Component<{ onRetry: () => void; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <TileErrorBody onRetry={() => this.setState({ hasError: false })} />;
    }
    return this.props.children;
  }
}

function TileBody({
  loading,
  error,
  retry,
  children,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
  children: ReactNode;
}): React.JSX.Element {
  if (error) {
    return <TileErrorBody onRetry={retry} />;
  }
  if (loading) {
    return <p className="text-[var(--color-text-muted)]">Loading…</p>;
  }
  return <>{children}</>;
}

export function Tile({
  title,
  loading,
  error,
  retry,
  children,
}: {
  title: string;
  loading: boolean;
  error: boolean;
  retry: () => void;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardContent>
        <TileBoundary onRetry={retry}>
          <TileBody loading={loading} error={error} retry={retry}>
            {children}
          </TileBody>
        </TileBoundary>
      </CardContent>
    </Card>
  );
}
