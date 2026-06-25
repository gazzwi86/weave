import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RulesView from './RulesView';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getRules: vi.fn(),
    getRelationshipTypes: vi.fn(),
    getNodeKinds: vi.fn(),
    createRule: vi.fn(),
    deleteRule: vi.fn(),
  },
}));

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const STATIC_RULE = {
  id: 'r1',
  category: 'Domain rules',
  relationship: 'inDomain',
  object_kind: 'BusinessDomain',
  object_kind_curie: 'weave:BusinessDomain',
  severity: 'Violation',
  message: null,
  is_custom: false,
};

const CUSTOM_RULE = {
  id: 'r2',
  category: 'Custom',
  relationship: 'uses',
  object_kind: 'Service',
  object_kind_curie: 'weave:Service',
  severity: 'Warning',
  message: null,
  is_custom: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getRelationshipTypes).mockResolvedValue([
    { key: 'inDomain', iri: 'weave:inDomain', label: 'inDomain' },
    { key: 'uses', iri: 'weave:uses', label: 'uses' },
  ]);
  vi.mocked(api.getNodeKinds).mockResolvedValue([
    { key: 'BusinessDomain', iri: 'weave:BusinessDomain', color: '#111' },
    { key: 'Service', iri: 'weave:Service', color: '#222' },
  ]);
});

describe('RulesView', () => {
  it('renders static rules from useRules()', async () => {
    vi.mocked(api.getRules).mockResolvedValue([STATIC_RULE]);
    render(<RulesView projectId="p1" />, { wrapper: wrapper() });
    expect(await screen.findByText('Domain rules')).toBeInTheDocument();
    // The rule card shows the relationship in a "IF a node <rel> something" sentence
    expect(screen.getAllByText('inDomain').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "+ Add rule" button and opens the add form on click', async () => {
    vi.mocked(api.getRules).mockResolvedValue([]);
    render(<RulesView projectId="p1" />, { wrapper: wrapper() });
    const addBtn = await screen.findByRole('button', { name: /Add rule/ });
    fireEvent.click(addBtn);
    expect(screen.getByText('Add constraint rule')).toBeInTheDocument();
  });

  it('the add form has relationship + target-kind dropdowns and a submit button', async () => {
    vi.mocked(api.getRules).mockResolvedValue([]);
    render(<RulesView projectId="p1" />, { wrapper: wrapper() });
    fireEvent.click(await screen.findByRole('button', { name: /Add rule/ }));
    expect(screen.getByLabelText('Relationship')).toBeInTheDocument();
    expect(screen.getByLabelText('Target must be a')).toBeInTheDocument();
    // Submit button: exact label "Add rule" (the toggle button now says "Cancel")
    const buttons = screen.getAllByRole('button', { name: 'Add rule' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('custom rules have a delete button; static rules do not', async () => {
    vi.mocked(api.getRules).mockResolvedValue([STATIC_RULE, CUSTOM_RULE]);
    render(<RulesView projectId="p1" />, { wrapper: wrapper() });
    await screen.findByText('Domain rules');
    const deleteButtons = screen.getAllByRole('button', { name: 'Delete rule' });
    expect(deleteButtons).toHaveLength(1);
  });
});
