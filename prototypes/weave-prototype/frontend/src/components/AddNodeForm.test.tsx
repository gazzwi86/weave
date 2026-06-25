import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddNodeForm from './AddNodeForm';
import type { NodeKind } from '../types';

const kinds: NodeKind[] = [
  { key: 'System', iri: 'x', color: '#2563eb' },
  { key: 'Service', iri: 'y', color: '#0891b2' },
];

describe('AddNodeForm', () => {
  it('renders the label field and kind options', () => {
    render(<AddNodeForm kinds={kinds} onSubmit={() => {}} onClose={() => {}} />);
    expect(screen.getByLabelText('Label')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Service' })).toBeInTheDocument();
  });

  it('submits the typed label and selected kind', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<AddNodeForm kinds={kinds} onSubmit={onSubmit} onClose={() => {}} />);

    await user.type(screen.getByLabelText('Label'), 'Billing');
    await user.selectOptions(screen.getByLabelText('Kind'), 'Service');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(onSubmit).toHaveBeenCalledWith({
      label: 'Billing',
      kind: 'Service',
      comment: undefined,
    });
  });

  it('does not submit when the label is blank', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<AddNodeForm kinds={kinds} onSubmit={onSubmit} onClose={() => {}} />);

    // Add button is disabled while the label is empty.
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
