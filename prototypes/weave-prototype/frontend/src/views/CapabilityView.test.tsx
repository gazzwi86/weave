import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CapabilityView from './CapabilityView';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getGraph: vi.fn(),
  },
}));

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CapabilityView', () => {
  it('shows "No capabilities yet" when the graph is empty', async () => {
    vi.mocked(api.getGraph).mockResolvedValue({ nodes: [], edges: [] });
    render(<CapabilityView projectId="p1" />, { wrapper: wrapper() });
    expect(await screen.findByText(/No capabilities yet/)).toBeInTheDocument();
  });

  it('renders domains as sections with their capabilities grouped underneath', async () => {
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [
        { id: 'd1', label: 'Customer', kind: 'BusinessDomain', color: '#111' },
        { id: 'c1', label: 'Onboarding', kind: 'BusinessCapability', color: '#222', domain: 'd1' },
        { id: 'c2', label: 'Billing', kind: 'BusinessCapability', color: '#333', domain: 'd1' },
      ],
      edges: [],
    });
    render(<CapabilityView projectId="p1" />, { wrapper: wrapper() });
    expect(await screen.findByText('Customer')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
  });

  it('shows "Unassigned" section for capabilities with no domain', async () => {
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [
        { id: 'c1', label: 'Orphan Cap', kind: 'BusinessCapability', color: '#222', domain: null },
      ],
      edges: [],
    });
    render(<CapabilityView projectId="p1" />, { wrapper: wrapper() });
    expect(await screen.findByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Orphan Cap')).toBeInTheDocument();
  });

  it('the colour dimension selector is present', async () => {
    vi.mocked(api.getGraph).mockResolvedValue({ nodes: [], edges: [] });
    render(<CapabilityView projectId="p1" />, { wrapper: wrapper() });
    // Wait for the loading state to resolve
    await screen.findByText(/No capabilities yet/);
    expect(screen.getByLabelText('Colour by')).toBeInTheDocument();
  });

  it('the dimension selector has all four options', async () => {
    vi.mocked(api.getGraph).mockResolvedValue({ nodes: [], edges: [] });
    render(<CapabilityView projectId="p1" />, { wrapper: wrapper() });
    await screen.findByText(/No capabilities yet/);
    const select = screen.getByLabelText('Colour by');
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'lifecycle_status' } });
    // lifecycle_status option exists
    expect(screen.getByRole('option', { name: 'Lifecycle status' })).toBeInTheDocument();
  });
});
