import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { downloadPoshReport } from '../report.js';

// Parse an uploaded training CSV. Positional: name, email, status, date
// (matches the standard export format, whose first column has no header).
function parseTrainingCsv(text) {
  const splitLine = (l) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  };
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  return lines.slice(1).map((l) => {
    const c = splitLine(l);
    return { name: (c[0] || '').trim(), email: (c[1] || '').trim(), status: (c[2] || '').trim(), date: (c[3] || '').trim() };
  }).filter((r) => r.name || r.email);
}

export default function TrainingReport({ notify }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All'); // All | Completed | Not completed
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.trainingReport().then(setData).catch((e) => setErr(e.message)); }, []);

  function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseTrainingCsv(String(reader.result || ''));
      if (rows.length === 0) return notify?.('No valid rows found in the CSV.');
      setBusy(true);
      try {
        const updated = await api.uploadTrainingReport(rows);
        setData(updated);
        notify?.(`Report updated — ${updated.total} users loaded.`);
      } catch (e2) { notify?.(`Upload failed: ${e2.message}`); }
      setBusy(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

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
        <div className="row" style={{ gap: 10 }}>
          <label className="btn" style={{ cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Uploading…' : 'Upload CSV'}
            <input type="file" accept=".csv,text/csv" onChange={onUpload} style={{ display: 'none' }} disabled={busy} />
          </label>
          <button className="btn btn-primary" onClick={() => downloadPoshReport(data.rows)}>Download CSV</button>
        </div>
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
