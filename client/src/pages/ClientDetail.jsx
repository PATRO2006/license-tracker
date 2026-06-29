import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { StatusChip, CapacityGauge } from '../components.jsx';
import RequestModal from './RequestModal.jsx';
import EditClientModal from './EditClientModal.jsx';

function Banner({ status, notes }) {
  if (status === 'Expired') return <div className="banner alert">⚠ Contract expired — renewal required before licenses can be reactivated.</div>;
  if (status === 'Over-utilized') return <div className="banner alert">⚠ Usage exceeds licenses ordered — review for renewal/upsell.</div>;
  if (status === 'At Capacity') return <div className="banner warn">▲ Nearing capacity — only a few licenses remain.</div>;
  if (status === 'Expiring Soon') return <div className="banner warn">◷ Contract nearing expiry — schedule a renewal.</div>;
  if (status === 'Warning') return <div className="banner warn">▲ Available licenses below threshold.</div>;
  if (notes) return <div className="banner info">{notes}</div>;
  return null;
}

export default function ClientDetail({ notify, onChange }) {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const navigate = useNavigate();

  const reload = () => api.client(id).then(setC).catch(() => {});
  useEffect(() => { reload(); }, [id]);

  if (!c) return <div className="content"><div className="empty">Loading…</div></div>;

  const available = c.available;
  const pending = c.requests.filter((r) => r.status === 'Pending');

  return (
    <>
      <div className="topbar">
        <div>
          <span className="back-link" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>← Back</span>
          <h1 className="row" style={{ gap: 12 }}>{c.name} <StatusChip status={c.status} /></h1>
          <div className="sub">Contact: {c.contact || '—'} · Login: {c.id}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" onClick={() => setShowEdit(true)}>Edit</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Raise request</button>
        </div>
      </div>

      <div className="content">
        <Banner status={c.status} notes={c.notes} />

        <div className="detail-grid">
          <div className="grid" style={{ gap: 18 }}>
            <div className="card detail-section">
              <h3>License Summary</h3>
              <div className="kv">
                <div className="box"><div className="k">Ordered</div><div className="v">{c.complimentary ? 'Compl.' : c.totalPurchased}</div></div>
                <div className="box"><div className="k">Used</div><div className="v">{c.activeLicenses}</div></div>
                <div className={`box${available < 0 ? ' danger' : ''}`}><div className="k">Available</div><div className="v">{available}</div></div>
                <div className="box"><div className="k">Pending</div><div className="v">{c.pendingLicenses}</div></div>
                <div className="box"><div className="k">Training Done</div><div className="v">{c.trainingCompleted}</div></div>
                <div className="box"><div className="k">Deactivated</div><div className="v">{c.deactivated}</div></div>
              </div>
              {c.deactivatedDetail && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Deactivations: {c.deactivatedDetail}</div>}
            </div>

            <div className="card detail-section">
              <h3>Account Details</h3>
              <div className="contract-row"><span className="k">Contact Person</span><span>{c.contact || '—'}</span></div>
              <div className="contract-row"><span className="k">Contact Email</span><span>{c.contactEmail || '—'}</span></div>
              <div className="contract-row"><span className="k">Licenses Shared On</span><span>{c.sharedOn || '—'}</span></div>
              <div className="contract-row"><span className="k">Utilization</span><span>{c.utilization}%</span></div>
              <div className="contract-row"><span className="k">Login Username</span><span style={{ color: 'var(--tertiary)', fontWeight: 600 }}>{c.id}</span></div>
            </div>

            <div className="card detail-section">
              <h3>License Request History</h3>
              {c.requests.length === 0 ? <div className="muted">No requests yet.</div> : (
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Type</th><th>Requested</th><th>Status</th><th>Completed</th></tr></thead>
                  <tbody>
                    {c.requests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.requestDate}</td>
                        <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                        <td>{r.requestedCount}</td>
                        <td><StatusChip status={r.status} /></td>
                        <td className="muted">{r.completionDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="grid" style={{ gap: 18 }}>
            <CapacityGauge percent={c.utilization} ordered={c.totalPurchased} used={c.activeLicenses} />

            {(c.status === 'Over-utilized' || c.status === 'At Capacity') && (
              <div className="upsell">
                <div className="tag">◆ Upsell opportunity</div>
                <p>Usage is at {c.utilization}% of ordered licenses. Consider an upsell of ~{Math.max(10, Math.ceil(c.activeLicenses * 0.4))} seats to restore healthy headroom.</p>
              </div>
            )}

            {c.training && c.training.length > 0 && (
              <div className="card detail-section">
                <h3>IC Training</h3>
                {c.training.map((t, i) => (
                  <div key={i} className="kv">
                    <div className="box"><div className="k">Ordered</div><div className="v">{t.ordered}</div></div>
                    <div className="box"><div className="k">Used</div><div className="v">{t.used}</div></div>
                    <div className="box"><div className="k">Completed</div><div className="v">{t.trainingCompleted}</div></div>
                  </div>
                ))}
              </div>
            )}

            <div className="card detail-section">
              <h3>Audit Trail</h3>
              <ul className="timeline">
                {(c.history || []).map((h) => (
                  <li key={h.id}>
                    <div className="t-date">{h.date}</div>
                    <div className="t-action">{h.action}{h.licenseDelta ? ` (+${h.licenseDelta})` : ''}</div>
                    <div className="t-detail">{h.detail}</div>
                    <div className="t-by">by {h.changedBy}</div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showModal && (
        <RequestModal
          clients={[{ id: c.id, name: c.name }]}
          defaultClientId={c.id}
          onClose={() => setShowModal(false)}
          onCreated={() => { reload(); onChange?.(); }}
          notify={notify}
        />
      )}
      {showEdit && (
        <EditClientModal
          client={c}
          onClose={() => setShowEdit(false)}
          onSaved={() => { reload(); onChange?.(); }}
          notify={notify}
        />
      )}
    </>
  );
}
