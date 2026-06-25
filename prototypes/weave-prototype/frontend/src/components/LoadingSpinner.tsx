interface Props {
  message?: string;
}

export default function LoadingSpinner({ message = 'Loading…' }: Props) {
  return (
    <div className="loading-state" role="status" aria-label={message}>
      <div className="spinner" aria-hidden="true" />
      <span className="loading-label">{message}</span>
    </div>
  );
}
