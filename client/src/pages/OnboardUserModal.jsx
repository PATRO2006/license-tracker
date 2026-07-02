import React, { useState } from 'react';
import { api } from '../api.js';

// A client onboards a new user. Captures the user's details and emails
// tech.support@ (no license change).
export default function OnboardUserModal({ clientId, onClose, onDone, notify }) {
  const [f, setF] = useState({ username: '', firstName: '', lastName: '', email: '', joiningDate: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!f.username && !f.email) return notify?.('Enter at least a username or email.');
    setBusy(true);
    try {
      await api.onboardUser({ ...(clientId ? { clientId } : {}), ...f });
      notify?.(`User onboarded. Notification sent to the tech team.`);
      onDone?.();
      onClose();
    } catch (err) {
      notify?.(`Failed: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Onboard a new user</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Details are sent to the tech team for setup. This does not change your license count.</p>
        <div className="field"><label>Username</label><input value={f.username} onChange={set('username')} placeholder="e.g. jdoe" /></div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>First name</label><input value={f.firstName} onChange={set('firstName')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Last name</label><input value={f.lastName} onChange={set('lastName')} /></div>
        </div>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={set('email')} placeholder="user@company.com" /></div>
        <div className="field"><label>Joining date</label><input type="date" value={f.joiningDate} onChange={set('joiningDate')} /></div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Onboard user'}</button>
        </div>
      </form>
    </div>
  );
}
