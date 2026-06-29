# Deployment Guide

The app deploys as **one service**: the Express server serves both the JSON API
and the built React frontend on a single port. So you only deploy `server/` with
the pre-built `client/dist/` alongside it.

```
client/dist  ──┐
               ├──►  Express (server/src/server.js)  ──►  one HTTP port
server/src   ──┘        /api/*  → API
                        /*      → React app (SPA fallback)
```

The frontend calls the API with relative `/api` paths, so it works on any host/
domain with no extra config.

---

## Option A — Docker (recommended, portable)

A multi-stage `Dockerfile` is included.

```bash
# from the project root
docker build -t license-tracker .
docker run -p 4000:4000 \
  -e NOTIFY_EMAIL=anusha@yourcompany.com \
  license-tracker
# open http://localhost:4000
```

To send real email, also pass the SMTP vars (see "Environment variables" below).
Push the image to any registry (Docker Hub, GHCR, ECR) and run it on ECS, Cloud
Run, Fly.io, a VPS, etc.

### Persisting data (important)

The app uses a real **SQLite database** (via sql.js) stored as a single file at
`$DATA_DIR/license-tracker.db`. In the Docker image `DATA_DIR=/data`. Mount a
volume there so the database survives restarts/redeploys:

```bash
docker run -p 4000:4000 -v lt-data:/data license-tracker
```

On first run with an empty data directory, the app auto-seeds the real client
data + logins. To reset, delete the `.db` file (or run `npm run seed`).

---

## Option B — Render / Railway / Heroku (PaaS, no Docker)

The root `package.json` exposes the two commands these platforms expect:

- **Build command:** `npm run build`
  (installs server + client deps, builds the React app, seeds initial data)
- **Start command:** `npm start`
  (runs the Express server, which serves API + frontend)

Steps (Render shown; Railway/Heroku are equivalent):

1. Push this folder to a Git repo.
2. New → **Web Service** → connect the repo.
3. Environment: **Node**. Build command `npm run build`, start command `npm start`.
4. Add environment variables (below). The platform sets `PORT` automatically —
   the server already reads `process.env.PORT`.
5. Deploy. Your URL serves the whole app.

> **Persistent disk (do this for real data):** Render's filesystem is ephemeral,
> so add a disk to keep the SQLite database. In the service → **Disks** → Add Disk,
> set Mount Path to `/data` (size 1 GB is plenty). The app reads `DATA_DIR=/data`
> automatically. Without a disk the data resets (and re-seeds) on each redeploy.

---

## Option C — Split hosting (static frontend + separate API)

If you prefer a static host (Vercel/Netlify/S3) for the UI and a separate API:

1. Backend: deploy `server/` (Docker or PaaS) → note its URL, e.g. `https://api.example.com`.
2. Frontend: build with the API origin baked into the proxy, or set the API base.
   The simplest path is to keep them same-origin (Options A/B). For split hosting,
   add a small `VITE_API_BASE` and prefix requests in `client/src/api.js`, then set
   CORS on the server to the frontend domain.

(Options A/B avoid this entirely — recommended unless you specifically need a CDN
for the UI.)

---

## Persistent data with free Postgres (Neon) — recommended

The app uses Postgres automatically when `DATABASE_URL` is set (otherwise SQLite).
Neon gives a free, always-on Postgres that survives redeploys:

1. Sign up at neon.tech → **Create project** (free tier).
2. Copy the **connection string** (looks like `postgresql://user:pass@ep-xxxx.aws.neon.tech/neondb?sslmode=require`).
3. Render → your service → **Environment** → add `DATABASE_URL` = that string → Save.
4. Redeploy. On first boot the app creates the tables and seeds the real client data.

No code changes needed — the data layer auto-detects Postgres. (If you skip this, the
app falls back to SQLite, which resets on each redeploy unless you attach a disk.)

## Real email with Resend

Emails (request raised → admin; approve/reject → client) send via SMTP when configured.
Resend has a free tier:

1. Sign up at resend.com, verify a sender domain/address, and create an **API key**.
2. Render → **Environment** → add:
   - `SMTP_HOST` = `smtp.resend.com`
   - `SMTP_PORT` = `465`
   - `SMTP_SECURE` = `true`
   - `SMTP_USER` = `resend`
   - `SMTP_PASS` = your Resend API key (`re_...`)
   - `SMTP_FROM` = a verified sender (e.g. `notifications@yourdomain.com`)
   - `NOTIFY_EMAIL` = `support@safespacesinc.in`
3. Redeploy. Without these, emails just log to the in-app Notifications screen.

## Environment variables

Set these in your host's dashboard (or a `server/.env` / shell `export`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | HTTP port (most PaaS set this for you) |
| `NOTIFY_EMAIL` | `anusha@example.com` | Notification recipient (Anusha) |
| `SMTP_FROM` | `license-tracker@example.com` | From address |
| `SMTP_HOST` | — | Enables real email when set |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_SECURE` | `false` | `true` for port 465 |
| `SMTP_USER` / `SMTP_PASS` | — | SMTP auth |

Without SMTP, notification emails are recorded to `server/data/outbox.json` and shown
on the in-app **Notifications** screen, so the workflow still works end-to-end.

---

## Health check

Point your platform's health check at:

```
GET /api/health  →  { "ok": true }
```

---

## Going to a real database (optional)

The data layer is isolated in `server/src/db.js` (just `load()` / `save()`), and all
business rules live in `server/src/logic.js`. To move off the JSON file:

1. Provision Postgres (Render/Railway/Supabase/RDS).
2. Replace `db.js` with a Prisma/Knex implementation exposing the same `load`/`save`
   (or per-entity queries). No changes needed in `logic.js` or the routes.
3. Run the seed once against the new DB.

---

## Pre-deploy checklist

- [ ] `npm run build` succeeds locally (builds `client/dist`, seeds data).
- [ ] `npm start` serves the UI at `/` and the API at `/api/*`.
- [ ] `GET /api/health` returns `{ ok: true }`.
- [ ] `NOTIFY_EMAIL` set to the real recipient.
- [ ] SMTP vars set if you want real email (otherwise outbox mode).
- [ ] Persistent storage configured if data must survive restarts.
