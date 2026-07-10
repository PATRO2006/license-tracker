import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { downloadPoshReport } from '../report.js';

// Parse an uploaded training CSV robustly:
//  1. Auto-detect the delimiter (comma, tab, semicolon, or pipe) — many
//     platform/Google exports are tab-separated, which previously dumped the
//     whole row into "name" and showed everyone as Not Completed.
//  2. Identify columns first by header name, then by VALUE (email = has "@",
//     status = "completed/not completed", date = a date/timestamp), so it
//     works no matter what the headers are called or what order they're in.
const DATE_RE = /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-\s][A-Za-z]{3,}[-\s]\d{2,4})\b/;
// Anchored: matches a status VALUE ("Completed", "Not completed") but not a
// column label like "Completed On", so header rows are still detected.
const STATUS_RE = /^(completed|not\s*completed|incomplete|complete|pending|yes|no|in\s*progress)$/i;

function parseTrainingCsv(text) {
  const clean = text.replace(/\r/g, '');
  const rawLines = clean.split('\n').filter((l) => l.trim());
  if (rawLines.length === 0) return [];

  // Detect delimiter: whichever splits the first line into the most fields.
  const cands = [',', '\t', ';', '|'];
  const delim = cands.reduce((best, d) =>
    (rawLines[0].split(d).length > rawLines[0].split(best).length ? d : best), ',');

  const splitLine = (l) => {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur); return out;
  };

  const matrix = rawLines.map((l) => splitLine(l).map((c) => c.trim()));
  // First row is a header if it has no email and no status-looking value.
  const firstIsHeader = !matrix[0].some((c) => c.includes('@') || STATUS_RE.test(c) || DATE_RE.test(c));
  const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
  const header = firstIsHeader ? matrix[0].map(norm) : [];
  const body = firstIsHeader ? matrix.slice(1) : matrix;
  if (body.length === 0) return [];
  const ncol = Math.max(...matrix.map((r) => r.length));

  const byName = (names) => header.findIndex((h) => names.some((n) => h.includes(n)));
  // Fraction of body rows whose column i matches a test.
  const frac = (i, test) => {
    let hit = 0, seen = 0;
    for (const r of body) { const v = (r[i] || ''); if (v) { seen++; if (test(v)) hit++; } }
    return seen ? hit / seen : 0;
  };
  const bestCol = (test, exclude) => {
    let best = -1, bestScore = 0.3; // need >30% of values to match
    for (let i = 0; i < ncol; i++) {
      if (exclude.includes(i)) continue;
      const s = frac(i, test);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  };

  // Header hints first, then value-based detection.
  let iE = byName(['email']); if (iE < 0) iE = bestCol((v) => v.includes('@'), []);
  let iS = byName(['status', 'completion', 'training', 'posh']); if (iS < 0) iS = bestCol((v) => STATUS_RE.test(v), [iE]);
  let iD = byName(['date', 'timestamp', 'completedon', 'completedat']); if (iD < 0) iD = bestCol((v) => DATE_RE.test(v), [iE, iS]);
  let iN = byName(['name', 'fullname', 'employee', 'participant']);
  if (iN < 0) iN = [...Array(ncol).keys()].find((i) => ![iE, iS, iD].includes(i)) ?? 0;

  const val = (c, i) => (i >= 0 && c[i] !== undefined ? c[i] : '');
  return body.map((c) => ({
    name: val(c, iN), email: val(c, iE), status: val(c, iS), date: val(c, iD),
  })).filter((r) => r.name || r.email);
}

export default function TrainingReport({ notify }) {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('All');
  const [busy, setBusy] = useState(false);
  const [rType, setRType] = useState('employee'); // Fittr: employee | coach

  const isFittr = clientId === 'fittr';

  useEffect(() => {
    api.clients().then((cs) => { setClients(cs); if (cs[0]) setClientId(cs[0].id); }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!clientId) return;
    setData(null);
    api.clientReport(clientId, rType).then(setData).catch(() => setData(null));
  }, [clientId, rType]);

  const clientName = clients.find((c) => c.id === clientId)?.name || '';
  const typeLabel = isFittr ? (rType === 'coach' ? 'Coaches' : 'Employees') : '';

  function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseTrainingCsv(String(reader.result || ''));
      if (rows.length === 0) return notify?.('No valid rows found in the CSV.');
      setBusy(true);
      try {
        const updated = await api.uploadClientReport(clientId, rows, rType);
        setData(updated);
        notify?.(`${clientName}${isFittr ? ` (${typeLabel})` : ''} report updated — ${updated.total} users loaded.`);
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
          <button className="btn btn-primary" onClick={() => downloadPoshReport(data?.rows || [], isFittr ? `${clientName}-${typeLabel}` : clientName)} disabled={!data || !data.total}>Download CSV</button>
        </div>
      </div>

      <div className="content">
        <div className="row" style={{ gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ marginTop: 0, maxWidth: 320, flex: 1 }}>
            <label>Client</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {isFittr && (
            <div className="row" style={{ gap: 8 }}>
              {['employee', 'coach'].map((t) => (
                <button key={t} className={`btn btn-sm${rType === t ? ' btn-primary' : ''}`} onClick={() => setRType(t)}>
                  {t === 'coach' ? 'Coaches' : 'Employees'}
                </button>
              ))}
            </div>
          )}
        </div>
        {isFittr && <div className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>Fittr has separate reports — upload/view the {typeLabel} report using the toggle above.</div>}

        {!data ? <div className="empty">Loading…</div> : data.total === 0 ? (
          <div className="card" style={{ marginTop: 18 }}><div className="empty">No {isFittr ? `${typeLabel} ` : ''}training report uploaded for {clientName} yet. Use “Upload CSV” to add one.</div></div>
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
