import React, { useState } from 'react';
import { api } from '../api.js';

const blank = () => ({ username: '', firstName: '', lastName: '', email: '', institution: '', joiningDate: '', userType: 'Employee' });

// Parse a pasted/uploaded CSV into user rows. Maps columns by header name
// (case/spacing-insensitive), so the order doesn't matter.
function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];
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
  const norm = (s) => s.trim().toLowerCase().replace(/[^a-z]/g, '');
  const header = splitLine(lines[0]).map(norm);
  const idx = (names) => header.findIndex((h) => names.includes(h));
  const iU = idx(['username', 'user']);
  const iF = idx(['firstname', 'first']);
  const iL = idx(['lastname', 'last']);
  const iE = idx(['email', 'emailaddress', 'emailid']);
  const iI = idx(['institution', 'institute', 'org', 'organisation', 'organization']);
  const iJ = idx(['joiningdate', 'joining', 'joindate', 'dateofjoining']);
  const iT = idx(['type', 'usertype', 'role', 'category', 'designation', 'position', 'usercategory']);
  const val = (cols, i) => (i >= 0 && cols[i] !== undefined ? cols[i].trim() : '');
  return lines.slice(1).map((l) => {
    const c = splitLine(l);
    const type = /coach/i.test(val(c, iT)) ? 'Coach' : 'Employee';
    return { username: val(c, iU), firstName: val(c, iF), lastName: val(c, iL), email: val(c, iE), institution: val(c, iI), joiningDate: val(c, iJ), userType: type };
  }).filter((r) => r.username || r.email);
}

export default function OnboardUserModal({ clientId, onClose, onDone, notify }) {
  const [rows, setRows] = useState([blank()]);
  const [busy, setBusy] = useState(false);
  const isFittr = clientId === 'fittr'; // Fittr splits users into Employees / Coaches
  // How to assign type to CSV-uploaded users: auto = read from CSV, else force all.
  const [csvType, setCsvType] = useState('auto');

  const setField = (i, k) => (e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const addRow = () => setRows((rs) => [...rs, blank()]);
  const removeRow = (i) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, j) => j !== i)));

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let parsed = parseCsv(String(reader.result || ''));
      if (parsed.length === 0) return notify?.('No valid rows found in the CSV.');
      // For Fittr, apply the chosen assignment: auto keeps CSV-detected types,
      // otherwise force all uploaded rows to Employee or Coach.
      if (isFittr && csvType !== 'auto') parsed = parsed.map((r) => ({ ...r, userType: csvType }));
      setRows(parsed);
      const coaches = parsed.filter((r) => r.userType === 'Coach').length;
      notify?.(`Loaded ${parsed.length} user${parsed.length > 1 ? 's' : ''} from CSV${isFittr ? ` (${coaches} coach${coaches === 1 ? '' : 'es'}, ${parsed.length - coaches} employee${parsed.length - coaches === 1 ? '' : 's'})` : ''} — review and submit.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    const users = rows.filter((r) => r.username || r.email);
    if (users.length === 0) return notify?.('Enter at least a username or email for one user.');
    setBusy(true);
    try {
      const res = await api.onboardUsersBulk(users.map((u) => ({ ...(clientId ? { clientId } : {}), ...u })));
      notify?.(`${res.count} user${res.count > 1 ? 's' : ''} onboarded. Notification sent to the tech team.`);
      onDone?.();
      onClose();
    } catch (err) {
      notify?.(`Failed: ${err.message}`);
      setBusy(false);
    }
  }

  const count = rows.filter((r) => r.username || r.email).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 680, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto' }}>
        <h2>Onboard new users</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Add users manually, or upload a CSV for many at once. Details are sent to the tech team — this does not change your license count.</p>

        <div className="req-row" style={{ marginTop: 14, background: 'rgba(255,255,255,.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
          <div style={{ fontSize: 13 }}>
            <b>Upload CSV</b>
            <div className="muted" style={{ fontSize: 12 }}>Columns: username, first name, last name, email, institution, joining date{isFittr ? ', type (Employee/Coach)' : ''}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {isFittr && (
              <select value={csvType} onChange={(e) => setCsvType(e.target.value)} style={{ fontSize: 12, padding: '6px 8px' }} title="How to set the type for uploaded users">
                <option value="auto">Type: auto-detect from CSV</option>
                <option value="Employee">All as Employees</option>
                <option value="Coach">All as Coaches</option>
              </select>
            )}
            <label className="btn btn-sm" style={{ cursor: 'pointer' }}>
              Choose file<input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {rows.map((r, i) => (
          <div key={i} className="card detail-section" style={{ marginTop: 14, padding: 14 }}>
            <div className="spread" style={{ marginBottom: 8 }}>
              <b style={{ fontSize: 13 }}>User {i + 1}</b>
              {rows.length > 1 && <button type="button" className="link" onClick={() => removeRow(i)}>Remove</button>}
            </div>
            <div className="row" style={{ gap: 10 }}>
              <div className="field" style={{ flex: 1, marginTop: 0 }}><label>Username</label><input value={r.username} onChange={setField(i, 'username')} placeholder="jdoe" /></div>
              <div className="field" style={{ flex: 1, marginTop: 0 }}><label>Email</label><input type="email" value={r.email} onChange={setField(i, 'email')} placeholder="user@company.com" /></div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>First name</label><input value={r.firstName} onChange={setField(i, 'firstName')} /></div>
              <div className="field" style={{ flex: 1 }}><label>Last name</label><input value={r.lastName} onChange={setField(i, 'lastName')} /></div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <div className="field" style={{ flex: 1 }}><label>Institution</label><input value={r.institution} onChange={setField(i, 'institution')} /></div>
              <div className="field" style={{ flex: 1 }}><label>Joining date</label><input type="date" value={r.joiningDate} onChange={setField(i, 'joiningDate')} /></div>
              {isFittr && (
                <div className="field" style={{ flex: 1 }}><label>Type</label>
                  <select value={r.userType} onChange={setField(i, 'userType')}>
                    <option value="Employee">Employee</option>
                    <option value="Coach">Coach</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        ))}

        <button type="button" className="btn btn-sm" style={{ marginTop: 12 }} onClick={addRow}>+ Add another user</button>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : `Onboard ${count || ''} user(s)`}</button>
        </div>
      </form>
    </div>
  );
}
