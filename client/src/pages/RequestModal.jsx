import React, { useState } from 'react';
import { api } from '../api.js';

// Raise a license request. You can request Employee Training and/or IC Training
// in one go, with a separate license count for each. Each selected training
// creates its own request record (so approval/history stay per-training).
export default function RequestModal({ clients, defaultClientId, onClose, onCreated, notify }) {
  const [clientId, setClientId] = useState(defaultClientId || (clients[0] && clients[0].id) || '');
  const [empChecked, setEmpChecked] = useState(true);
  const [empCount, setEmpCount] = useState(10);
  const [icChecked, setIcChecked] = useState(false);
  const [icCount, setIcCount] = useState(5);
  const [type, setType] = useState('additional');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!empChecked && !icChecked) return notify?.('Select at least one training.');
    setBusy(true);
    try {
      const jobs = [];
      if (empChecked) jobs.push(api.createRequest({ clientId, category: 'employee', type, requestedCount: Number(empCount), details }));
      if (icChecked) jobs.push(api.createRequest({ clientId, category: 'ic', type, requestedCount: Number(icCount), details }));
      await Promise.all(jobs);
      const name = clients.find((c) => c.id === clientId)?.name || 'client';
      notify?.(`Request${jobs.length > 1 ? 's' : ''} created for ${name}. Notification sent to the admin team.`);
      onCreated?.();
      onClose();
    } catch (err) {
      notify?.(`Failed: ${err.message}`);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Raise license request</h2>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>Choose one or both trainings and set the licenses for each.</p>

        <div className="field">
          <label>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Request for</label>
          <div className="req-row">
            <label className="checkbox"><input type="checkbox" checked={empChecked} onChange={(e) => setEmpChecked(e.target.checked)} /> Employee Training</label>
            <input type="number" min="0" value={empCount} onChange={(e) => setEmpCount(e.target.value)} disabled={!empChecked} style={{ width: 110, opacity: empChecked ? 1 : 0.5 }} placeholder="licenses" />
          </div>
          <div className="req-row" style={{ marginTop: 8 }}>
            <label className="checkbox"><input type="checkbox" checked={icChecked} onChange={(e) => setIcChecked(e.target.checked)} /> IC Training</label>
            <input type="number" min="0" value={icCount} onChange={(e) => setIcCount(e.target.value)} disabled={!icChecked} style={{ width: 110, opacity: icChecked ? 1 : 0.5 }} placeholder="licenses" />
          </div>
        </div>

        <div className="field">
          <label>Request type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="new">New licenses</option>
            <option value="additional">Additional licenses</option>
            <option value="renewal">Renewal / recharge</option>
          </select>
        </div>

        <div className="field">
          <label>Request details</label>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Reason / context for this request" />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </form>
    </div>
  );
}
