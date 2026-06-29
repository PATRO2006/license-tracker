import React, { useState } from 'react';
import { api } from '../api.js';

export default function ChangePasswordModal({ onClose, notify }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (next.length < 6) return setErr('New password must be at least 6 characters.');
    if (next !== confirm) return setErr('New passwords do not match.');
    setBusy(true);
    try {
      await api.changePassword(cur, next);
      notify?.('Password changed successfully.');
      onClose();
    } catch (e2) {
      setErr(e2.message || 'Could not change password.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Change password</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Update the password for your account.</p>
        {err && <div className="auth-error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="field"><label>Current password</label><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
        <div className="field"><label>New password</label><input type="password" value={next} onChange={(e) => setNext(e.target.value)} required /></div>
        <div className="field"><label>Confirm new password</label><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
        </div>
      </form>
    </div>
  );
}
