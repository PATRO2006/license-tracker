import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { downloadPoshReport } from '../report.js';

export default function TrainingReport() {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All'); // All | Completed | Not completed
  const [err, setErr] = useState('');

  useEffect(() => { api.trainingReport().then(setData).catch((e) => setErr(e.message)); }, []);

  if (err) return <div className="content"><div className="empty">Could not load report: {err}</div></div>;
  if (!data) return <div className="content"><div className="empty">Loading…</div></div>;

  const rows = data.rows.filter((r) => {
    const matchesQ = !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase());
    const isCompleted = r.status.trim().toLowerCase() === 'completed';
    const matchesF = filter === 'All' || (filter === 'Completed' ? isCompleted : !isCompleted);
    return matchesQ && matchesF;
  });
  const pct = data.total ? Math.round((data.completed / data.total) * 1000) / 10 : 0;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>{data.title} — Report</h1>
          <div className="sub">Per-user training progress</div>
        </div>
        <button className="btn btn-primary" onClick={() => downloadPoshReport(data.rows)}>Download CSV</button>
      </div>

      <div className="content">
        <div className="grid grid-stats">
          <div className="card stat"><div className="label">Total Users</div><div className="value">{data.total}</div></div>
          <div className="card stat"><div className="label">Completed</div><div className="value">{data.completed}</div><div className="delta">{pct}% completion</div></div>
          <div className="card stat"><div className="label">Not Completed</div><div className="value">{data.notCompleted}</div><div className="delta warn">Pending</div></div>
          <div className="card stat"><div className="label">Completion Rate</div><div className="value">{pct}%</div></div>
        </div>

        <div className="row" style={{ gap: 8, margin: '18px 0 16px', flexWrap: 'wrap' }}>
          {['All', 'Completed', 'Not completed'].map((f) => (
            <button key={f} className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
          <div className="field" style={{ margin: 0, maxWidth: 280, flex: 1 }}>
            <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Completed On</th></tr></thead>
            <tbody>
              {rows.slice(0, 1000).map((r, i) => {
                const done = r.status.trim().toLowerCase() === 'completed';
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="muted">{r.email}</td>
                    <td><span className={`chip ${done ? 'healthy' : 'expired'}`}>{done ? 'Completed' : 'Not completed'}</span></td>
                    <td className="muted">{r.date ? r.date.split(' ')[0] : '—'}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan="4"><div className="empty">No matching users.</div></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Showing {Math.min(rows.length, 1000)} of {rows.length} matching users.</div>
      </div>
    </>
  );
}
