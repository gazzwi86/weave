import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import DataTable, { type Column } from './DataTable';

interface Row {
  id: string;
  name: string;
  n: number;
}

const rows: Row[] = [
  { id: 'a', name: 'Charlie', n: 2 },
  { id: 'b', name: 'Alice', n: 3 },
  { id: 'c', name: 'Bob', n: 1 },
];

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortValue: (r) => r.name, render: (r) => r.name },
  { key: 'n', header: 'Count', sortValue: (r) => r.n, render: (r) => r.n },
];

function names() {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((tr) => tr.querySelector('td')?.textContent);
}

describe('DataTable', () => {
  it('sorts ascending by the initial column', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} initialSortKey="name" />);
    expect(names()).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('toggles to descending when the active header is clicked', () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} initialSortKey="name" />);
    fireEvent.click(screen.getByRole('columnheader', { name: /Name/ }));
    expect(names()).toEqual(['Charlie', 'Bob', 'Alice']);
  });

  it('renders the empty state for no rows', () => {
    render(
      <DataTable columns={columns} rows={[]} rowKey={(r) => r.id} empty={<p>Nothing here</p>} />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
