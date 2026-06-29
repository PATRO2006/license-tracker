import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { StatusChip } from '../components.jsx';

function Stat({ label, value, delta, warn }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className={`delta${warn ? ' warn' : ''}`}>{delta}</div>}
    </div>
  );
}

function ClientCard({ c, onClick }) {
  const alert = c.status === 'Over-utilized' || c.status === 'Expired';
  const barClass = c.utilization > 100 ? 'over' : c.utilization >= 95 ? 'cap' : c.utilization < 80 ? 'ok' : '';
  return (
    <div className={`card client-card${alert ? ' alert' : ''}`} onClick={onClick}>
      <div className="head">
        <div>
          <div className="name">{c.name}</div>
          <div className="owner">{c.accountOwner}</div>
        </div>
        <StatusChip status={c.status} />
      </div>
      <div>
        <div className="usage-label">
          <span>Capacity Usage</span>
          <b>{c.utilization}%</b>
        </div>
        <div className={`bar ${barClass}`}><span style={{ width: `${Math.min(c.utilization, 100)}%` }} /></div>
      </div>
      <div className="metric-row">
        <span>Used <b>{c.activeLicenses}</b></span>
        <span>Ordered <b>{c.totalPurchased}</b></span>
        <span>Pending <b>{c.pendingLicenses}</b></span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboard().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="content"><div className="empty">Could not reach API: {err}</div></div>;
  if (!data) return <div className="content"><div className="empty">Loading…</div></div>;

  const hs = data.healthSummary || {};
  return (
    <>
      <div className="topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">License allocation, utilization and renewals across all clients</div>
        </div>
      </div>
      <div className="content">
        <div className="grid grid-stats">
          <Stat label="Total Clients" value={data.totalClients} delta="Active this month" />
          <Stat label="Total Licenses" value={data.totalLicenses} delta={`${data.activeLicenses} active`} />
          <Stat label="Available Licenses" value={data.availableLicenses} delta={`${data.overCapacity} over capacity`} warn={data.overCapacity > 0} />
          <Stat label="Pending Requests" value={data.pendingRequests} delta="Awaiting action" warn={data.pendingRequests > 0} />
        </div>

        <div className="grid grid-stats" style={{ marginTop: 18 }}>
          <Stat label="Contracts Expiring Soon" value={data.expiringSoon} delta="Within 30 days" warn={data.expiringSoon > 0} />
          <Stat label="Expired Licenses" value={data.expired} delta="Needs renewal" warn={data.expired > 0} />
          <Stat label="Active Licenses" value={data.activeLicenses} />
          <Stat label="Healthy Accounts" value={hs['Healthy'] || 0} />
        </div>

        <div className="spread" style={{ marginTop: 28 }}>
          <div className="section-title" style={{ margin: 0 }}>Clients</div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(hs).map(([k, v]) => (
              <span key={k} className="row" style={{ gap: 6, fontSize: 13 }}>
                <StatusChip status={k} /> <b>{v}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-clients" style={{ marginTop: 14 }}>
          {data.clients.map((c) => (
            <ClientCard key={c.id} c={c} onClick={() => navigate(`/clients/${c.id}`)} />
          ))}
        </div>
      </div>
    </>
  );
}
