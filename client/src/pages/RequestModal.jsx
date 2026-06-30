import React, { useState } from 'react';
import { api } from '../api.js';

// Modal for raising a new license request. Submitting triggers the
// backend email notification to Anusha.
export default function RequestModal({ clients, defaultClientId, onClose, onCreated, notify }) {
  const [clientId, setClientId] = useState(defaultClientId || (clients[0] && clients[0].id) || '');
  const [category, setCategory] = useState('employee');
  const [type, setType] = useState('additional');
  const [requestedCount, setRequestedCount] = useState(10);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.createRequest({ clientId, category, type, requestedCount: Number(requestedCount), details });
      const name = clients.find((c) => c.id === clientId)?.name || 'client';
      notify?.(`Request created for ${name}. Email notification ${res.emailQueued ? 'sent' : 'queued'} to the admin team.`);
      onCreated?.(res.request);
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
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>An email notification is sent to the admin team automatically.</p>

        <div className="field">
          <label>Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="field">
          <label>Request for</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="employee">Employee Training (main licenses)</option>
            <option value="ic">IC Training</option>
          </select>
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
          <label>{category === 'ic' ? 'Requested IC Training seats' : 'Requested license count'}</label>
          <input type="number" min="0" value={requestedCount} onChange={(e) => setRequestedCount(e.target.value)} />
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
