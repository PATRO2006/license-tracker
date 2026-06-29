import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { StatusChip } from '../components.jsx';
import RequestModal from './RequestModal.jsx';
import AddClientModal from './AddClientModal.jsx';

export default function Clients({ notify, onChange }) {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const navigate = useNavigate();

  const reload = () => api.clients().then(setClients).catch(() => {});
  useEffect(() => { reload(); }, []);

  const filtered = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Clients</h1>
          <div className="sub">{clients.length} accounts under management</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={() => setShowRequest(true)}>+ New request</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add client</button>
        </div>
      </div>
      <div className="content">
        <div className="field" style={{ marginTop: 0, maxWidth: 320 }}>
          <input placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="card" style={{ marginTop: 18, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Client</th><th>Status</th><th>Utilization</th><th>Used</th>
                <th>Ordered</th><th>Available</th><th>Pending</th><th>Shared on</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clients/${c.id}`)}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{c.contact || '—'}</div>
                  </td>
                  <td><StatusChip status={c.status} /></td>
                  <td><b>{c.utilization}%</b></td>
                  <td>{c.activeLicenses}</td>
                  <td>{c.totalPurchased}</td>
                  <td style={{ color: c.available < 0 ? 'var(--over-fg)' : 'inherit', fontWeight: c.available < 0 ? 700 : 400 }}>{c.available}</td>
                  <td>{c.pendingLicenses}</td>
                  <td className="muted">{c.sharedOn || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="8"><div className="empty">No clients match “{q}”.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showRequest && (
        <RequestModal
          clients={clients}
          onClose={() => setShowRequest(false)}
          onCreated={() => { reload(); onChange?.(); }}
          notify={notify}
        />
      )}
      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onCreated={() => { reload(); onChange?.(); }}
          notify={notify}
        />
      )}
    </>
  );
}
