import React, { useState } from 'react';
import { api } from '../api.js';

const blank = () => ({ username: '', firstName: '', lastName: '', email: '', joiningDate: '' });

// A client onboards one or more new users. Captures details and emails
// tech.support@ (no license change).
export default function OnboardUserModal({ clientId, onClose, onDone, notify }) {
  const [rows, setRows] = useState([blank()]);
  const [busy, setBusy] = useState(false);

  const setField = (i, k) => (e) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  const addRow = () => setRows((rs) => [...rs, blank()]);
  const removeRow = (i) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((_, j) => j !== i)));

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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 640, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto' }}>
        <h2>Onboard new users</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Add one or more users. Details are sent to the tech team for setup — this does not change your license count.</p>

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
              <div className="field" style={{ flex: 1 }}><label>Joining date</label><input type="date" value={r.joiningDate} onChange={setField(i, 'joiningDate')} /></div>
            </div>
          </div>
        ))}

        <button type="button" className="btn btn-sm" style={{ marginTop: 12 }} onClick={addRow}>+ Add another user</button>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : `Onboard ${rows.filter((r) => r.username || r.email).length || ''} user(s)`}</button>
        </div>
      </form>
    </div>
  );
}
