import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Legend from './Legend';
import type { NodeKind } from '../types';

const kinds: NodeKind[] = [
  { key: 'System', iri: 'weave:System', color: '#2563eb' },
  { key: 'Service', iri: 'weave:Service', color: '#0891b2' },
];

describe('Legend', () => {
  it('renders static spans when not interactive', () => {
    render(<Legend kinds={kinds} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('calls onToggle with the kind key when clicked', () => {
    const onToggle = vi.fn();
    render(<Legend kinds={kinds} hidden={new Set()} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('button', { name: /System/ }));
    expect(onToggle).toHaveBeenCalledWith('System');
  });

  it('marks hidden kinds as toggled off', () => {
    const onToggle = vi.fn();
    render(<Legend kinds={kinds} hidden={new Set(['Service'])} onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: /Service/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: /System/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
