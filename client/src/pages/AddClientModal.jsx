import React, { useState } from 'react';
import { api } from '../api.js';

// Admin-only: create a new client AND auto-provision its login.
export default function AddClientModal({ onClose, onCreated, notify }) {
  const [form, setForm] = useState({
    name: '', contact: '', contactEmail: '', totalPurchased: 0, activeLicenses: 0, pendingLicenses: 0,
    icOrdered: 0, icUsed: 0, icCompleted: 0, contractEnd: '', password: '',
  });
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.addClient({
        name: form.name, contact: form.contact, contactEmail: form.contactEmail,
        totalPurchased: Number(form.totalPurchased), activeLicenses: Number(form.activeLicenses),
        pendingLicenses: Number(form.pendingLicenses),
        icOrdered: Number(form.icOrdered), icUsed: Number(form.icUsed), icCompleted: Number(form.icCompleted),
        contractEnd: form.contractEnd || undefined,
        password: form.password || undefined,
      });
      setCreds(res.credentials);
      onCreated?.(res.client);
      notify?.(`Client "${form.name}" created with login ${res.credentials.username}.`);
    } catch (err) {
      notify?.(`Failed: ${err.message}`);
      setBusy(false);
    }
  }

  if (creds) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Client created</h2>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>Share these login credentials with the client. They can change them later.</p>
          <div className="auth-demo-creds" style={{ marginTop: 16, textAlign: 'left', lineHeight: 1.8 }}>
            <div>Username: <b>{creds.username}</b></div>
            <div>Password: <b>{creds.password}</b></div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Add new client</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>A login is created automatically for this client.</p>
        <div className="field"><label>Company name</label><input value={form.name} onChange={set('name')} required placeholder="e.g. Acme Corp" /></div>
        <div className="field"><label>Contact person</label><input value={form.contact} onChange={set('contact')} placeholder="Optional" /></div>
        <div className="field"><label>Contact email</label><input type="email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="Optional" /></div>
        <div className="section-title" style={{ marginTop: 16, marginBottom: 0 }}>Employee Training</div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Ordered</label><input type="number" min="0" value={form.totalPurchased} onChange={set('totalPurchased')} required /></div>
          <div className="field" style={{ flex: 1 }}><label>Used</label><input type="number" min="0" value={form.activeLicenses} onChange={set('activeLicenses')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Pending</label><input type="number" value={form.pendingLicenses} onChange={set('pendingLicenses')} /></div>
        </div>
        <div className="section-title" style={{ marginTop: 12, marginBottom: 0 }}>IC Training</div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Ordered</label><input type="number" min="0" value={form.icOrdered} onChange={set('icOrdered')} required /></div>
          <div className="field" style={{ flex: 1 }}><label>Used</label><input type="number" min="0" value={form.icUsed} onChange={set('icUsed')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Completed</label><input type="number" min="0" value={form.icCompleted} onChange={set('icCompleted')} /></div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Contract end (optional)</label><input type="date" value={form.contractEnd} onChange={set('contractEnd')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Password (optional)</label><input value={form.password} onChange={set('password')} placeholder="auto if blank" /></div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create client'}</button>
        </div>
      </form>
    </div>
  );
}
