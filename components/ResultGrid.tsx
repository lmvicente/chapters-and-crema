'use client';

import type { QueryResult } from '@/lib/types';

function cell(v: unknown) {
  if (v === null || v === undefined) return <span className="null">NULL</span>;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function ResultGrid({ result }: { result: QueryResult }) {
  if (result.columns.length === 0) {
    return <p className="empty-note">The query ran, but it doesn’t return any columns.</p>;
  }
  return (
    <div className="grid-wrap" tabIndex={0} aria-label="Query results">
      <table className="grid">
        <thead>
          <tr>
            <th className="rownum" aria-label="Row number" />
            {result.columns.map((c, i) => (
              <th key={i} className={c.numeric ? 'num' : undefined}>
                <span className="col-name">{c.name}</span>
                <span className="col-type">{c.type}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.length === 0 ? (
            <tr>
              <td className="rownum" />
              <td colSpan={result.columns.length} className="empty-row">
                No rows
              </td>
            </tr>
          ) : (
            result.rows.map((row, r) => (
              <tr key={r}>
                <td className="rownum">{r + 1}</td>
                {row.map((v, i) => (
                  <td key={i} className={result.columns[i]?.numeric ? 'num' : undefined}>
                    {cell(v)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
