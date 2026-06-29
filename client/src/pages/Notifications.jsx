import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Shows the email outbox — every notification the system has generated for
// Anusha. In production these are delivered via SMTP; here they are also
// recorded so the workflow is visible end-to-end.
export default function Notifications() {
  const [outbox, setOutbox] = useState([]);

  useEffect(() => { api.outbox().then(setOutbox).catch(() => {}); }, []);

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Email Notifications</h1>
          <div className="sub">{outbox.length} {outbox.length === 1 ? 'message' : 'messages'}</div>
        </div>
      </div>
      <div className="content">
        {outbox.length === 0 ? (
          <div className="card"><div className="empty">No notifications yet. Raise a license request to generate one.</div></div>
        ) : (
          <div className="grid" style={{ gap: 14, gridTemplateColumns: '1fr' }}>
            {outbox.map((m, i) => (
              <div key={i} className="card detail-section">
                <div className="spread">
                  <div style={{ fontWeight: 700 }}>{m.subject}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{new Date(m.sentAt).toLocaleString()}</div>
                </div>
                <div className="muted" style={{ fontSize: 13, margin: '4px 0 12px' }}>To: {m.to}</div>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font)', fontSize: 13.5, margin: 0, color: 'var(--text)' }}>{m.text}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
