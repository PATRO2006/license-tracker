import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import ChangePasswordModal from './pages/ChangePasswordModal.jsx';

const slug = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

// ---------- Minimal inline icon set (stroke style) ----------
const PATHS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  clients: 'M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m0 0a4 4 0 1 1 6 0M16 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  requests: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-4-5.7V5a2 2 0 0 0-4 0v.3A6 6 0 0 0 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0',
  gauge: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 0 4-4M5 19a9 9 0 1 1 14 0',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5',
  mail: 'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0 2 8 6 8-6',
  lock: 'M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm2 0V7a5 5 0 0 1 10 0v4',
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7zm11 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'eye-off': 'M17.9 17.9A10.7 10.7 0 0 1 12 19c-7 0-11-7-11-7a19 19 0 0 1 5.1-5.9m3.9-1A10.7 10.7 0 0 1 12 5c7 0 11 7 11 7a19 19 0 0 1-2.2 3.2M1 1l22 22M9.9 9.9a3 3 0 0 0 4.2 4.2',
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  search: 'M21 21l-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
};

export function Icon({ name, size = 18 }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export function StatusChip({ status }) {
  return <span className={`chip ${slug(status)}`}>{status}</span>;
}

export function CapacityGauge({ percent, ordered, used }) {
  const pct = Math.max(0, Math.min(percent, 130));
  const radius = 90;
  const circ = Math.PI * radius;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const over = pct > 100;
  const color = over ? 'var(--over-fg)' : pct >= 95 ? 'var(--capacity-fg)' : pct >= 80 ? 'var(--warning-fg)' : 'var(--healthy-fg)';
  return (
    <div className="gauge-card card">
      <svg width="220" height="128" viewBox="0 0 220 128">
        <path d="M 20 118 A 90 90 0 0 1 200 118" fill="none" stroke="var(--bg)" strokeWidth="18" strokeLinecap="round" />
        <path d="M 20 118 A 90 90 0 0 1 200 118" fill="none" stroke={color} strokeWidth="18" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} />
      </svg>
      <div style={{ marginTop: -52 }}>
        <div style={{ fontSize: 34, fontWeight: 800, color }}>{percent}%</div>
        <div className="muted" style={{ fontSize: 12, letterSpacing: '.05em', textTransform: 'uppercase', fontWeight: 600 }}>Capacity</div>
      </div>
      <div style={{ marginTop: 30, fontSize: 15 }}>
        <b>{used}</b> <span className="muted">/ {ordered} ordered</span>
      </div>
      {over && (
        <div className="muted" style={{ fontSize: 12, color: 'var(--over-fg)', marginTop: 4 }}>
          +{used - ordered} users above threshold
        </div>
      )}
    </div>
  );
}

export function Sidebar({ pendingCount, notify }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [showPw, setShowPw] = useState(false);
  const link = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">L</span> License Tracker
      </div>
      <nav className="nav">
        {isAdmin ? (
          <>
            <NavLink to="/" end className={link}><Icon name="dashboard" /> Dashboard</NavLink>
            <NavLink to="/clients" className={link}><Icon name="clients" /> Clients</NavLink>
            <NavLink to="/requests" className={link}>
              <Icon name="requests" /> Requests
              {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
            </NavLink>
            <NavLink to="/notifications" className={link}><Icon name="bell" /> Notifications</NavLink>
          </>
        ) : (
          <NavLink to="/" end className={link}><Icon name="dashboard" /> My Dashboard</NavLink>
        )}
      </nav>

      <div className="sidebar-foot">
        {user && (
          <div className="user-chip">
            <span className="avatar">{user.initials || user.name?.slice(0, 2).toUpperCase()}</span>
            <span className="user-meta">
              <b>{user.name}</b>
              <span>{user.role}</span>
            </span>
            <button className="icon-btn" onClick={() => setShowPw(true)} aria-label="Change password" title="Change password"><Icon name="lock" /></button>
            <button className="icon-btn" onClick={logout} aria-label="Log out" title="Log out"><Icon name="logout" /></button>
          </div>
        )}
      </div>
      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} notify={notify} />}
    </aside>
  );
}

export function Toast({ message, onClose }) {
  React.useEffect(() => {
    if (!message) return;
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [message, onClose]);
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
