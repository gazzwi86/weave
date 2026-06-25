import { useMemo, useState } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  /** Provide to make the column sortable; returns the value to sort on. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  initialSortKey?: string;
  empty?: React.ReactNode;
}

type Dir = 'asc' | 'desc';

function compare(a: string | number, b: string | number): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

/** A small, generic, client-sorted table shared by the data views. */
export default function DataTable<T>({ columns, rows, rowKey, initialSortKey, empty }: Props<T>) {
  const [sortKey, setSortKey] = useState(initialSortKey ?? columns[0]?.key);
  const [dir, setDir] = useState<Dir>('asc');

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const value = col.sortValue;
    const copy = [...rows];
    copy.sort((a, b) => (dir === 'asc' ? 1 : -1) * compare(value(a), value(b)));
    return copy;
  }, [rows, columns, sortKey, dir]);

  function toggle(key: string) {
    if (key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setDir('asc');
    }
  }

  if (rows.length === 0) {
    return <>{empty ?? <p className="muted">Nothing to show.</p>}</>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          {columns.map((c) => {
            const active = c.sortValue && c.key === sortKey;
            return (
              <th
                key={c.key}
                className={c.sortValue ? 'sortable' : undefined}
                aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                onClick={c.sortValue ? () => toggle(c.key) : undefined}
              >
                {c.header}
                {active ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((c) => (
              <td key={c.key}>{c.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
