import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusChip } from '../components.jsx';
import RequestModal from './RequestModal.jsx';

const FILTERS = ['All', 'Pending', 'Approved', 'Rejected', 'Completed'];
const catLabel = (c) => (c === 'ic' ? 'IC Training' : 'Employee Training');

export default function Requests({ notify, onChange }) {
  const [requests, setRequests] = useState([]);
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // request being edited
  const [editCount, setEditCount] = useState(0);
  const [editDetails, setEditDetails] = useState('');

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

  function openEdit(r) {
    setEditing(r);
    setEditCount(r.requestedCount);
    setEditDetails(r.details || '');
  }
  async function saveEdit(e) {
    e.preventDefault();
    try {
      await api.editRequest(editing.id, { requestedCount: Number(editCount), details: editDetails });
      notify?.('Request updated.');
      setEditing(null);
      reload();
      onChange?.();
    } catch (err) {
      notify?.(`Failed: ${err.message}`);
    }
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
              <tr><th>Client</th><th>For</th><th>Type</th><th>Requested</th><th>Date</th><th>Status</th><th>Details</th><th>Action</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{clientName(r.clientId)}</td>
                  <td><span className={`chip ${r.category === 'ic' ? 'pending' : 'approved'}`}>{catLabel(r.category)}</span></td>
                  <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                  <td><b>+{r.requestedCount}</b></td>
                  <td className="muted">{r.requestDate}</td>
                  <td><StatusChip status={r.status} /></td>
                  <td className="muted" style={{ maxWidth: 220, fontSize: 13 }}>{r.details}</td>
                  <td>
                    {r.status === 'Pending' ? (
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(r)}>Edit</button>
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

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <h2>Edit request</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>{clientName(editing.clientId)} · {catLabel(editing.category)} — adjust before approving.</p>
            <div className="field"><label>Requested count</label><input type="number" min="0" value={editCount} onChange={(e) => setEditCount(e.target.value)} /></div>
            <div className="field"><label>Details</label><textarea value={editDetails} onChange={(e) => setEditDetails(e.target.value)} /></div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
