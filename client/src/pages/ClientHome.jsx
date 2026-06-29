import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { StatusChip, CapacityGauge, Icon } from '../components.jsx';
import RequestModal from './RequestModal.jsx';

function Banner({ status, notes }) {
  if (status === 'Over-utilized') return <div className="banner alert"><Icon name="alert" size={16} /> Your usage exceeds the licenses ordered — contact your account manager about adding seats.</div>;
  if (status === 'At Capacity') return <div className="banner warn">▲ You're nearing capacity — only a few licenses remain.</div>;
  if (status === 'Warning') return <div className="banner warn">▲ Available licenses are running low.</div>;
  if (status === 'Expired') return <div className="banner alert"><Icon name="alert" size={16} /> Contract expired — renewal required.</div>;
  if (notes) return <div className="banner info">{notes}</div>;
  return null;
}

function TrainingCard({ training }) {
  if (!training || training.length === 0) return null;
  return (
    <div className="card detail-section">
      <h3>IC Training</h3>
      {training.map((t, i) => (
        <div key={i} className="kv" style={{ marginBottom: i < training.length - 1 ? 12 : 0 }}>
          <div className="box"><div className="k">Ordered</div><div className="v">{t.ordered}</div></div>
          <div className="box"><div className="k">Used</div><div className="v">{t.used}</div></div>
          <div className="box"><div className="k">Completed</div><div className="v">{t.trainingCompleted}</div></div>
        </div>
      ))}
      {training[0].date && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Shared on {training[0].date}</div>}
    </div>
  );
}

export default function ClientHome({ notify, onChange }) {
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const reload = () => api.dashboard().then((d) => setC(d.client)).catch(() => {});
  useEffect(() => { reload(); }, []);

  if (!c) return <div className="content"><div className="empty">Loading…</div></div>;

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="row" style={{ gap: 12 }}>Welcome, {c.name} <StatusChip status={c.status} /></h1>
          <div className="sub">Your license overview {c.contact ? `· Contact: ${c.contact}` : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>Raise request</button>
      </div>

      <div className="content">
        <Banner status={c.status} notes={c.notes} />

        <div className="grid grid-stats">
          <div className="card stat"><div className="label">Licenses Ordered</div><div className="value">{c.totalPurchased}</div>{c.complimentary && <div className="delta">Complimentary</div>}</div>
          <div className="card stat"><div className="label">Used</div><div className="value">{c.activeLicenses}</div><div className="delta">{c.utilization}% utilized</div></div>
          <div className="card stat"><div className="label">Available</div><div className="value">{c.available}</div>{c.available < 0 && <div className="delta warn">Over capacity</div>}</div>
          <div className="card stat"><div className="label">Licenses Pending</div><div className="value">{c.pendingLicenses}</div></div>
        </div>

        <div className="detail-grid" style={{ marginTop: 18 }}>
          <div className="grid" style={{ gap: 18 }}>
            <div className="card detail-section">
              <h3>License Summary</h3>
              <div className="kv">
                <div className="box"><div className="k">Training Completed</div><div className="v">{c.trainingCompleted}</div></div>
                <div className={`box${c.deactivated ? '' : ''}`}><div className="k">Deactivated</div><div className="v">{c.deactivated}</div></div>
                <div className="box"><div className="k">Utilization</div><div className="v">{c.utilization}%</div></div>
              </div>
              {c.deactivatedDetail && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>Deactivations: {c.deactivatedDetail}</div>}
            </div>

            <div className="card detail-section">
              <h3>Account Details</h3>
              <div className="contract-row"><span className="k">Contact Person</span><span>{c.contact || '—'}</span></div>
              <div className="contract-row"><span className="k">Licenses Shared On</span><span>{c.sharedOn || '—'}</span></div>
              <div className="contract-row"><span className="k">Account</span><span style={{ color: 'var(--tertiary)', fontWeight: 600 }}>{user.username}</span></div>
            </div>

            <div className="card detail-section">
              <h3>My License Requests</h3>
              {c.requests.length === 0 ? <div className="muted">No requests yet.</div> : (
                <table className="tbl">
                  <thead><tr><th>Date</th><th>Type</th><th>Requested</th><th>Status</th></tr></thead>
                  <tbody>
                    {c.requests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.requestDate}</td>
                        <td style={{ textTransform: 'capitalize' }}>{r.type}</td>
                        <td>+{r.requestedCount}</td>
                        <td><StatusChip status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="grid" style={{ gap: 18 }}>
            <CapacityGauge percent={c.utilization} ordered={c.totalPurchased} used={c.activeLicenses} />
            <TrainingCard training={c.training} />
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
    </>
  );
}
