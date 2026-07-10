import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { StatusChip, TrainingPanel, Icon, SplitDownload } from '../components.jsx';
import RequestModal from './RequestModal.jsx';
import OnboardUserModal from './OnboardUserModal.jsx';
import { downloadClientReport, downloadUsersReport, downloadPoshReport } from '../report.js';

function Banner({ status, notes }) {
  if (status === 'Over-utilized') return <div className="banner alert"><Icon name="alert" size={16} /> Your usage exceeds the licenses ordered — contact your account manager about adding seats.</div>;
  if (status === 'At Capacity') return <div className="banner warn">▲ You're nearing capacity — only a few licenses remain.</div>;
  if (status === 'Warning') return <div className="banner warn">▲ Available licenses are running low.</div>;
  if (status === 'Expired') return <div className="banner alert"><Icon name="alert" size={16} /> Contract expired — renewal required.</div>;
  if (notes) return <div className="banner info">{notes}</div>;
  return null;
}

export default function ClientHome({ notify, onChange }) {
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [report, setReport] = useState(null);
  const [showRequest, setShowRequest] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);

  const reload = () => api.dashboard().then((d) => {
    setC(d.client);
    api.clientReport(d.client.id).then(setReport).catch(() => setReport(null));
  }).catch(() => {});
  useEffect(() => { reload(); }, []);

  if (!c) return <div className="content"><div className="empty">Loading…</div></div>;

  const ic = c.training || [];
  const hasIC = ic.length > 0;
  const icOrdered = ic.reduce((s, t) => s + t.ordered, 0);
  const icUsed = ic.reduce((s, t) => s + t.used, 0);
  const icCompleted = ic.reduce((s, t) => s + t.trainingCompleted, 0);

  // Fittr: download the uploaded training report for a given type.
  async function downloadReportFor(type, label) {
    try {
      const r = await api.clientReport(c.id, type);
      if (!r.rows || r.rows.length === 0) return notify?.(`No ${label} report uploaded yet.`);
      downloadPoshReport(r.rows, `${c.name}-${label}`);
    } catch (e) { notify?.(`Download failed: ${e.message}`); }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1 className="row" style={{ gap: 12 }}>Welcome, {c.name} <StatusChip status={c.status} /></h1>
          <div className="sub">Your license overview {c.contact ? `· Contact: ${c.contact}` : ''}</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          {c.id === 'fittr' ? (
            <SplitDownload label="Download report" options={[
              { label: 'Download Employees report', onClick: () => downloadReportFor('employee', 'Employees') },
              { label: 'Download Coaches report', onClick: () => downloadReportFor('coach', 'Coaches') },
            ]} />
          ) : (
            <button className="btn" onClick={() => downloadClientReport(c)}>Download report</button>
          )}
          <button className="btn" onClick={() => setShowOnboard(true)}>Onboard user</button>
          <button className="btn btn-primary" onClick={() => setShowRequest(true)}>Raise request</button>
        </div>
      </div>

      <div className="content">
        <Banner status={c.status} notes={c.notes} />

        <div className="grid grid-stats">
          <div className="card stat"><div className="label">Licenses Ordered</div><div className="value">{c.totalPurchased}</div>{c.complimentary && <div className="delta">Complimentary</div>}</div>
          <div className="card stat"><div className="label">Used</div><div className="value">{c.activeLicenses}</div><div className="delta">{c.utilization}% utilized</div></div>
          <div className="card stat"><div className="label">Available</div><div className="value">{c.available}</div>{c.available < 0 && <div className="delta warn">Over capacity</div>}</div>
          <div className="card stat"><div className="label">Licenses Pending</div><div className="value">{c.pendingLicenses}</div></div>
        </div>

        {/* Training overview — Employee & IC side by side (comparison), each with its own capacity */}
        <div className="section-title">Training Overview</div>
        <div className="grid" style={{ gridTemplateColumns: hasIC ? '1fr 1fr' : '1fr', gap: 18 }}>
          <TrainingPanel title="Employee Training" ordered={c.totalPurchased} used={c.activeLicenses} completed={c.trainingCompleted} note={c.complimentary ? 'Complimentary licenses' : undefined} />
          {hasIC && <TrainingPanel title="IC Training" ordered={icOrdered} used={icUsed} completed={icCompleted} note={ic[0].date ? `Shared on ${ic[0].date}` : undefined} />}
        </div>

        <div className="detail-grid" style={{ marginTop: 18 }}>
          <div className="grid" style={{ gap: 18 }}>
            <div className="card detail-section">
              <h3>Account Details</h3>
              <div className="contract-row"><span className="k">Contact Person</span><span>{c.contact || '—'}</span></div>
              <div className="contract-row"><span className="k">Licenses Shared On</span><span>{c.sharedOn || '—'}</span></div>
              <div className="contract-row"><span className="k">Deactivated</span><span>{c.deactivated}{c.deactivatedDetail ? ` (${c.deactivatedDetail})` : ''}</span></div>
              <div className="contract-row"><span className="k">Account</span><span style={{ color: 'var(--tertiary)', fontWeight: 600 }}>{user.username}</span></div>
            </div>

            <div className="card detail-section">
              <h3>My License Requests</h3>
              {c.requests.length === 0 ? <div className="muted">No requests yet.</div> : (
                <table className="tbl">
                  <thead><tr><th>Date</th><th>For</th><th>Type</th><th>Requested</th><th>Status</th></tr></thead>
                  <tbody>
                    {c.requests.map((r) => (
                      <tr key={r.id}>
                        <td>{r.requestDate}</td>
                        <td>{r.category === 'ic' ? 'IC Training' : 'Employee'}</td>
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
            <div className="card detail-section">
              <div className="spread" style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>Training Report</h3>
                {report && report.total > 0 && (
                  <button className="btn btn-sm" onClick={() => downloadPoshReport(report.rows, c.name)}>Download CSV</button>
                )}
              </div>
              {!report || report.total === 0 ? (
                <div className="muted">No training report available yet.</div>
              ) : (
                <div className="kv">
                  <div className="box"><div className="k">Users</div><div className="v">{report.total}</div></div>
                  <div className="box"><div className="k">Completed</div><div className="v">{report.completed}</div></div>
                  <div className="box"><div className="k">Pending</div><div className="v">{report.notCompleted}</div></div>
                </div>
              )}
            </div>

            <div className="card detail-section">
              <div className="spread" style={{ marginBottom: 14 }}>
                <h3 style={{ margin: 0 }}>Information Sent to Tech Team</h3>
                {c.onboardings && c.onboardings.length > 0 && (
                  <button className="btn btn-sm" onClick={() => downloadUsersReport(c.name, c.onboardings)}>Download users CSV</button>
                )}
              </div>
              {(!c.onboardings || c.onboardings.length === 0) ? (
                <div className="muted">No information sent yet. Use “Onboard user” to send user details to the tech team.</div>
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
          </div>
        </div>
      </div>

      {showRequest && (
        <RequestModal
          clients={[{ id: c.id, name: c.name }]}
          defaultClientId={c.id}
          onClose={() => setShowRequest(false)}
          onCreated={() => { reload(); onChange?.(); }}
          notify={notify}
        />
      )}
      {showOnboard && (
        <OnboardUserModal
          clientId={c.id}
          onClose={() => setShowOnboard(false)}
          onDone={() => { reload(); onChange?.(); }}
          notify={notify}
        />
      )}
    </>
  );
}
