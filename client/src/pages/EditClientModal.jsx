import React, { useState } from 'react';
import { api } from '../api.js';

// Admin: edit a client's data, including contract dates (which enable the
// Expiring Soon / Expired statuses) and the contact email (used for emails).
export default function EditClientModal({ client, onClose, onSaved, notify }) {
  const [f, setF] = useState({
    contact: client.contact || '', contactEmail: client.contactEmail || '',
    contractStart: client.contractStart || '', contractEnd: client.contractEnd || '',
    renewalDate: client.renewalDate || '',
    totalPurchased: client.totalPurchased ?? 0, activeLicenses: client.activeLicenses ?? 0,
    pendingLicenses: client.pendingLicenses ?? 0, trainingCompleted: client.trainingCompleted ?? 0,
    deactivated: client.deactivated ?? 0, deactivatedDetail: client.deactivatedDetail || '',
    notes: client.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...f,
        totalPurchased: Number(f.totalPurchased), activeLicenses: Number(f.activeLicenses),
        pendingLicenses: Number(f.pendingLicenses), trainingCompleted: Number(f.trainingCompleted),
        deactivated: Number(f.deactivated),
      };
      const updated = await api.editClient(client.id, body);
      notify?.(`${client.name} updated.`);
      onSaved?.(updated);
      onClose();
    } catch (err) {
      notify?.(`Failed: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} style={{ width: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <h2>Edit {client.name}</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Set contract dates to enable expiry alerts.</p>

        <div className="field"><label>Contact person</label><input value={f.contact} onChange={set('contact')} /></div>
        <div className="field"><label>Contact email (for notifications)</label><input type="email" value={f.contactEmail} onChange={set('contactEmail')} placeholder="client@company.com" /></div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Contract start</label><input type="date" value={f.contractStart} onChange={set('contractStart')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Contract end</label><input type="date" value={f.contractEnd} onChange={set('contractEnd')} /></div>
        </div>
        <div className="field"><label>Renewal / recharge date</label><input type="date" value={f.renewalDate} onChange={set('renewalDate')} /></div>

        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Ordered</label><input type="number" value={f.totalPurchased} onChange={set('totalPurchased')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Used</label><input type="number" value={f.activeLicenses} onChange={set('activeLicenses')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Pending</label><input type="number" value={f.pendingLicenses} onChange={set('pendingLicenses')} /></div>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><label>Training completed</label><input type="number" value={f.trainingCompleted} onChange={set('trainingCompleted')} /></div>
          <div className="field" style={{ flex: 1 }}><label>Deactivated</label><input type="number" value={f.deactivated} onChange={set('deactivated')} /></div>
        </div>
        <div className="field"><label>Deactivation detail</label><input value={f.deactivatedDetail} onChange={set('deactivatedDetail')} placeholder="e.g. 2 + 3 (Jan) + 1 (Mar)" /></div>
        <div className="field"><label>Notes</label><textarea value={f.notes} onChange={set('notes')} /></div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  );
}
