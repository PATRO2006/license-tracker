# License Tracking System

A full-stack, multi-tenant License Tracking System: an **admin** (Anusha) sees and
manages every client, while **each client logs in to their own isolated dashboard**
and can see only their own data. Dark glassmorphism UI.

Covers all six core areas — client license management, history/audit trail, health &
status monitoring, dashboard & reporting, request management, email notifications —
plus per-client logins, IC Training tracking, and real client data.

## Stack

- **Backend** — Node.js + Express, **SQLite** database (via sql.js — a real SQL DB in
  a single file, no native build, no external service), bcrypt password hashing,
  token auth with server-enforced per-client isolation, nodemailer (with outbox fallback).
- **Frontend** — React 18 + Vite + React Router, hand-built dark glassmorphism CSS.

## Logins

See `CREDENTIALS.md`. Admin: `anusha` / `Admin@2026`. Each client: username = company
slug, password = `CompanyName@2026` (e.g. `fittr` / `Fittr@2026`).

## Run it

Two terminals.

```bash
# 1. API  (http://localhost:4000)
cd server
npm install
npm run seed     # creates the SQLite DB with real client data + logins
npm start

# 2. Web UI  (http://localhost:5173)
cd client
npm install
npm run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` to the backend.

### Optional: real email

By default, notifications are written to `server/data/outbox.json` and shown on the
**Notifications** screen. To send real email, set SMTP env vars before `npm start`:

```bash
export SMTP_HOST=smtp.example.com SMTP_PORT=587 SMTP_USER=... SMTP_PASS=...
export NOTIFY_EMAIL=anusha@yourcompany.com
```

## What to try

1. **Dashboard** — totals, expiring/expired counts, health summary, client cards.
2. Click a client (e.g. **Fittr**) → detail page with capacity gauge, contract details,
   request history and audit trail.
3. **Raise request** → creates a Pending request and fires an email to Anusha.
4. **Requests** screen → approve / reject / complete. Completing an "additional"
   request adds the licenses and writes an audit-trail entry.
5. **Notifications** screen → every generated email.

See `SPEC.md` for the full technical specification (data models, status rules,
API reference, workflows).

## Project layout

```
license-tracker/
├── SPEC.md                 # technical specification
├── server/
│   └── src/
│       ├── server.js       # Express app + routes
│       ├── logic.js        # license health / status rules
│       ├── email.js        # notification service
│       ├── db.js           # JSON store
│       └── seed.js         # sample data
└── client/
    └── src/
        ├── pages/          # Dashboard, Clients, ClientDetail, Requests, Notifications
        ├── components.jsx  # StatusChip, CapacityGauge, Sidebar
        └── styles.css      # design system
```

> `node_modules/` and `server/data/` are generated; they can be deleted and recreated
> with `npm install` and `npm run seed`.
