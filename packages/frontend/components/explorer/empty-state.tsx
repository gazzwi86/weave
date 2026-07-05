// ponytail: stub -- red before green (TDD step 1).
export interface EmptyStateProps {
  message: string;
  onRetry: () => void;
}

export function EmptyState(_props: EmptyStateProps): never {
  throw new Error("not implemented");
}
