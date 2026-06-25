import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QueryView from './QueryView';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    sparqlQuery: vi.fn(),
    sparqlNl: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QueryView', () => {
  it('renders the SPARQL and Natural language mode tabs', () => {
    render(<QueryView projectId="p1" />, { wrapper: wrapper() });
    expect(screen.getByRole('button', { name: 'SPARQL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Natural language' })).toBeInTheDocument();
  });

  it('shows example query buttons in SPARQL mode', () => {
    render(<QueryView projectId="p1" />, { wrapper: wrapper() });
    expect(screen.getByRole('button', { name: 'All concepts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Systems and domains' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All relationships' })).toBeInTheDocument();
  });

  it('displays a result table when the query returns columns and rows', async () => {
    vi.mocked(api.sparqlQuery).mockResolvedValue({
      columns: ['id', 'label'],
      rows: [{ id: 'node:1', label: 'Orders' }],
    });
    render(<QueryView projectId="p1" />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('1 row')).toBeInTheDocument();
  });

  it('displays an error message when the query fails', async () => {
    vi.mocked(api.sparqlQuery).mockRejectedValue(new Error('Bad SPARQL syntax'));
    render(<QueryView projectId="p1" />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Bad SPARQL syntax');
  });

  it('switches to Natural language tab and shows the NL textarea', () => {
    render(<QueryView projectId="p1" />, { wrapper: wrapper() });
    fireEvent.click(screen.getByRole('button', { name: 'Natural language' }));
    expect(screen.getByLabelText('Natural language question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument();
  });
});
