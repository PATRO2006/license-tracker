import React, { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { Icon } from '../components.jsx';

// Floating client logo tiles. Each shows /logos/<id>.png if present, else the
// initials as a fallback. id=client slug (logo filename), c=fallback initials.
const BUBBLES = [
  { id: 'fittr', c: 'FT', s: 64, t: '14%', l: '8%', d: 9, delay: 0 },
  { id: 'biopeak', c: 'BP', s: 48, t: '30%', l: '20%', d: 11, delay: 1.2 },
  { id: 'gsp-crop', c: 'GS', s: 54, t: '62%', l: '6%', d: 10, delay: 0.6 },
  { id: 'machaxi', c: 'MX', s: 42, t: '78%', l: '18%', d: 12, delay: 2 },
  { id: 'tech-japan', c: 'TJ', s: 58, t: '46%', l: '13%', d: 9.5, delay: 1.8 },
  { id: 'quantana', c: 'QT', s: 46, t: '20%', l: '34%', d: 13, delay: 0.3 },
  { id: 'sunfan', c: 'SF', s: 40, t: '70%', l: '33%', d: 11.5, delay: 2.4 },
  { id: 'invarsys', c: 'IV', s: 50, t: '86%', l: '44%', d: 10.5, delay: 1 },
];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
    } catch (e2) {
      setErr('Invalid username/email or password.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-bg" />
      <div className="bubbles" aria-hidden="true">
        {BUBBLES.map((b, i) => (
          <span key={i} className="bubble" style={{ width: b.s, height: b.s, top: b.t, left: b.l, animationDuration: `${b.d}s`, animationDelay: `${b.delay}s`, fontSize: b.s * 0.34 }}>
            <span className="bubble-fallback">{b.c}</span>
            <img
              src={`/logos/${b.id}.png`}
              alt=""
              className="bubble-logo"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </span>
        ))}
      </div>
      <div className="auth-shell">
        <div className="auth-hero">
          <div className="auth-logo"><span className="brand-mark lg">L</span> License Tracker</div>
          <h1>Stay ahead of every license, renewal and request.</h1>
          <p>Complete visibility into allocations, utilization and contract health — with automated alerts so nothing slips through.</p>
          <ul className="auth-points">
            <li><Icon name="gauge" /> Real-time capacity &amp; health monitoring</li>
            <li><Icon name="bell" /> Automated renewal &amp; request notifications</li>
            <li><Icon name="history" /> Full audit trail and reporting</li>
          </ul>
        </div>

        <form className="auth-card" onSubmit={submit}>
          <div className="auth-logo mobile"><span className="brand-mark">L</span> License Tracker</div>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your workspace to continue.</p>

          {err && <div className="auth-error"><Icon name="alert" /> {err}</div>}

          <div className="field">
            <label>Username or email</label>
            <div className="input-icon">
              <Icon name="mail" />
              <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="company username or admin email" autoComplete="username" required />
            </div>
          </div>

          <div className="field">
            <label>Password</label>
            <div className="input-icon">
              <Icon name="lock" />
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" required />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label="Toggle password">
                <Icon name={show ? 'eye-off' : 'eye'} />
              </button>
            </div>
          </div>

          <div className="auth-row">
            <label className="checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember me
            </label>
            <a href="#" onClick={(e) => e.preventDefault()} className="link">Forgot password?</a>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="auth-foot muted">© {new Date().getFullYear()} License Tracker · Secure access</div>
        </form>
      </div>
    </div>
  );
}
