import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusChip } from '../components.jsx';
import RequestModal from './RequestModal.jsx';

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected', 'Completed'];

export default function Requests({ notify, onChange }) {
  const [requests, setRequests] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);

  const reload = () => api.requests().then(setRequests).catch(() => {});
  useEffect(() => {
    reload();
    api.clients().then(setClients).catch(() => {});
  }, []);

  const clientName = (cid) => clients.find((c) => c.id === cid)?.name || cid;
  const shown = filter === 'All' ? requests : requests.filter((r) => r.status === filter);

  async function setStatus(r, status) {
    await api.updateRequest(r.id, status);
    notify?.(`Request for ${clientName(r.clientId)} marked ${status}.`);
    reload();
    onChange?.();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>License Requests</h1>
          <div className="sub">{requests.filter((r) => r.status === 'Pending').length} pending · {requests.length} total</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New request</button>
      </div>
      <div className="content">
        <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button key={f} className={`btn btn-sm${filter === f ? ' btn-primary' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr><th>Client</th><th>Type</th><th>Requested</th><th>Current</th><th>Date</th><th>Status</th><th>Details</th><th>Action</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{clientName(r.clientId)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                  <td><b>+{r.requestedCount}</b></td>
                  <td>{r.currentCount}</td>
                  <td className="muted">{r.requestDate}</td>
                  <td><StatusChip status={r.status} /></td>
                  <td className="muted" style={{ maxWidth: 240, fontSize: 13 }}>{r.details}</td>
                  <td>
                    {r.status === 'Pending' ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-sm btn-success" onClick={() => setStatus(r, 'Approved')}>Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setStatus(r, 'Rejected')}>Reject</button>
                      </div>
                    ) : r.status === 'Approved' ? (
                      <button className="btn btn-sm btn-primary" onClick={() => setStatus(r, 'Completed')}>Complete</button>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan="8"><div className="empty">No {filter.toLowerCase()} requests.</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <RequestModal
          clients={clients}
          onClose={() => setShowModal(false)}
          onCreated={() => { reload(); onChange?.(); }}
          notify={notify}
        />
      )}
    </>
  );
}
