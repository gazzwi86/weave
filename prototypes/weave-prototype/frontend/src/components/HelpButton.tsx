interface Props {
  onClick: () => void;
}

export default function HelpButton({ onClick }: Props) {
  return (
    <button
      className="help-fab"
      onClick={onClick}
      aria-label="Help & feature guide"
      title="Help & feature guide"
    >
      ?
    </button>
  );
}
