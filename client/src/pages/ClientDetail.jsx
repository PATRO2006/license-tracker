import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { StatusChip, TrainingPanel, SplitDownload } from '../components.jsx';
import RequestModal from './RequestModal.jsx';
import EditClientModal from './EditClientModal.jsx';
import { downloadClientReport, downloadUsersReport } from '../report.js';

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

  async function handleDelete() {
    if (!window.confirm(`Delete client "${c.name}"?\n\nThis permanently removes the client, its login, licenses, onboarded users, uploaded reports and history. This cannot be undone.`)) return;
    try {
      await api.deleteClient(c.id);
      notify?.(`Client "${c.name}" deleted.`);
      onChange?.();
      navigate('/clients');
    } catch (err) {
      notify?.(`Delete failed: ${err.message}`);
    }
  }

  if (!c) return <div className="content"><div className="empty">Loading…</div></div>;

  const available = c.available;
  const ic = c.training || [];
  const hasIC = ic.length > 0;
  const icOrdered = ic.reduce((s, t) => s + t.ordered, 0);
  const icUsed = ic.reduce((s, t) => s + t.used, 0);
  const icCompleted = ic.reduce((s, t) => s + t.trainingCompleted, 0);

  return (
    <>
      <div className="topbar">
        <div>
          <span className="back-link" style={{ cursor: 'pointer' }} onClick={() => navigate(-1)}>← Back</span>
          <h1 className="row" style={{ gap: 12 }}>{c.name} <StatusChip status={c.status} /></h1>
          <div className="sub">Contact: {c.contact || '—'} · Login: {c.id}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {c.id === 'fittr' ? (
            <SplitDownload label="Download report" options={[
              { label: 'Download for Employees', onClick: () => downloadUsersReport(c.name, c.onboardings, 'Employee') },
              { label: 'Download for Coaches', onClick: () => downloadUsersReport(c.name, c.onboardings, 'Coach') },
            ]} />
          ) : (
            <button className="btn" onClick={() => downloadClientReport(c)}>Download report</button>
          )}
          <button className="btn" onClick={() => setShowEdit(true)}>Edit</button>
          <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>Raise request</button>
        </div>
      </div>

      <div className="content">
        <Banner status={c.status} notes={c.notes} />

        <div className="section-title" style={{ marginTop: 0 }}>Training Overview</div>
        <div className="grid" style={{ gridTemplateColumns: hasIC ? '1fr 1fr' : '1fr', gap: 18, marginBottom: 18 }}>
          <TrainingPanel title="Employee Training" ordered={c.totalPurchased} used={c.activeLicenses} completed={c.trainingCompleted} note={c.complimentary ? 'Complimentary licenses' : undefined} />
          {hasIC && <TrainingPanel title="IC Training" ordered={icOrdered} used={icUsed} completed={icCompleted} note={ic[0].date ? `Shared on ${ic[0].date}` : undefined} />}
        </div>

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
            {(c.status === 'Over-utilized' || c.status === 'At Capacity') && (
              <div className="upsell">
                <div className="tag">◆ Upsell opportunity</div>
                <p>Usage is at {c.utilization}% of ordered licenses. Consider an upsell of ~{Math.max(10, Math.ceil(c.activeLicenses * 0.4))} seats to restore healthy headroom.</p>
              </div>
            )}

            <div className="card detail-section">
              <div className="spread" style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>Information Sent to Tech Team</h3>
                {c.onboardings && c.onboardings.length > 0 && (
                  <button className="btn btn-sm" onClick={() => downloadUsersReport(c.name, c.onboardings)}>Download users CSV</button>
                )}
              </div>
              {(!c.onboardings || c.onboardings.length === 0) ? (
                <div className="muted">No information sent yet.</div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>Name</th><th>Username</th><th>Joined</th></tr></thead>
                  <tbody>
                    {c.onboardings.map((o) => (
                      <tr key={o.id}>
                        <td>{[o.firstName, o.lastName].filter(Boolean).join(' ') || '—'}</td>
                        <td className="muted">{o.username || o.email || '—'}</td>
                        <td className="muted">{o.joiningDate || o.createdAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

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
