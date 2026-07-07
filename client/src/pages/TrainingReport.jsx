import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { downloadPoshReport } from '../report.js';

// Parse an uploaded training CSV. Maps columns by HEADER name (case/spacing
// insensitive) so any column order works; falls back to positional
// (name, email, status, date) if the headers aren't recognised. This fixes
// reports where only the name printed because the columns were in a different
// order than expected.
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
  if (lines.length === 0) return [];
  const norm = (s) => s.trim().toLowerCase().replace(/[^a-z]/g, '');
  const header = splitLine(lines[0]).map(norm);
  const idx = (names) => header.findIndex((h) => names.includes(h));
  let iN = idx(['name', 'fullname', 'employeename', 'username']);
  let iE = idx(['email', 'emailaddress', 'emailid']);
  let iS = idx(['status', 'trainingstatus', 'completion', 'completionstatus']);
  let iD = idx(['date', 'completedon', 'completiondate', 'timestamp', 'completedat']);
  const headerRecognised = iN >= 0 || iE >= 0 || iS >= 0;
  if (!headerRecognised) { iN = 0; iE = 1; iS = 2; iD = 3; }
  const val = (c, i) => (i >= 0 && c[i] !== undefined ? c[i].trim() : '');
  return lines.slice(headerRecognised ? 1 : 0).map((l) => {
    const c = splitLine(l);
    return { name: val(c, iN), email: val(c, iE), status: val(c, iS), date: val(c, iD) };
  }).filter((r) => r.name || r.email);
}

export default function TrainingReport({ notify }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.clients().then((cs) => { setClients(cs); if (cs[0]) setClientId(cs[0].id); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!clientId) return;
    setData(null);
    api.clientReport(clientId).then(setData).catch(() => setData(null));
  }, [clientId]);

  const clientName = clients.find((c) => c.id === clientId)?.name || '';

  function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseTrainingCsv(String(reader.result || ''));
      if (rows.length === 0) return notify?.('No valid rows found in the CSV.');
      setBusy(true);
      try {
        const updated = await api.uploadClientReport(clientId, rows);
        setData(updated);
        notify?.(`${clientName} report updated — ${updated.total} users loaded.`);
      } catch (e2) { notify?.(`Upload failed: ${e2.message}`); }
      setBusy(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const rows = (data?.rows || []).filter((r) => {
    const matchesQ = !q || (r.name || '').toLowerCase().includes(q.toLowerCase()) || (r.email || '').toLowerCase().includes(q.toLowerCase());
    const done = (r.status || '').trim().toLowerCase() === 'completed';
    const matchesF = filter === 'All' || (filter === 'Completed' ? done : !done);
    return matchesQ && matchesF;
  });
  const pct = data && data.total ? Math.round((data.completed / data.total) * 1000) / 10 : 0;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Training Reports</h1>
          <div className="sub">Per-client POSH training progress</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <label className="btn" style={{ cursor: clientId ? 'pointer' : 'default', opacity: busy || !clientId ? 0.6 : 1 }}>
            {busy ? 'Uploading…' : 'Upload CSV'}
            <input type="file" accept=".csv,text/csv" onChange={onUpload} style={{ display: 'none' }} disabled={busy || !clientId} />
          </label>
          <button className="btn btn-primary" onClick={() => downloadPoshReport(data?.rows || [], clientName)} disabled={!data || !data.total}>Download CSV</button>
        </div>
      </div>

      <div className="content">
        <div className="field" style={{ marginTop: 0, maxWidth: 320 }}>
          <label>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {!data ? <div className="empty">Loading…</div> : data.total === 0 ? (
          <div className="card" style={{ marginTop: 18 }}><div className="empty">No training report uploaded for {clientName} yet. Use “Upload CSV” to add one.</div></div>
        ) : (
          <>
            <div className="grid grid-stats" style={{ marginTop: 18 }}>
              <div className="card stat"><div className="label">Total Users</div><div className="value">{data.total}</div></div>
              <div className="card stat"><div className="label">Completed</div><div className="value">{data.completed}</div><div className="delta">{pct}%</div></div>
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
                    const done = (r.status || '').trim().toLowerCase() === 'completed';
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
          </>
        )}
      </div>
    </>
  );
}
