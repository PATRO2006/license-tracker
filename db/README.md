# Database setup

The app supports two databases and creates all tables automatically on first run:

- **PostgreSQL** — used when the `DATABASE_URL` environment variable is set (recommended for production; persists data).
- **SQLite** — used otherwise; a single file at `server/data/license-tracker.db` (zero setup, good for local/dev).

## Setting up a fresh database

You normally don't need to run any SQL manually — on first boot the app:
1. Creates the tables (see `server/src/db.js → createSchema`), and
2. If empty, seeds the real client data + accounts (`server/src/seed.js`).

### Option A — Let the app create it (simplest)
1. Provision a Postgres database (e.g. Neon, free) and copy its connection string.
2. Set `DATABASE_URL` in the environment.
3. Start the app — it creates the tables and seeds data on first boot.

### Option B — Pre-provision with the SQL script
If you want to create the schema manually (e.g. on a managed Postgres instance):

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

Then seed the initial data:

```bash
cd server
DATABASE_URL=... npm run seed
```

## Backups

Your production data (Neon Postgres) is backed up two ways:

- **Automatic** — Neon takes continuous backups with point-in-time restore. On the
  free tier this keeps a short history window; paid plans extend it to days/weeks.
  Manage/restore from the Neon dashboard.
- **On-demand** — run the included script to save a snapshot you can keep or share:

  ```bash
  DATABASE_URL="postgresql://…" ./db/backup.sh
  # → db/backups/backup-YYYYMMDD-HHMMSS.sql   (restore: psql "$DATABASE_URL" -f <file>)
  ```

  Without `DATABASE_URL` it copies the local SQLite file instead.

## Re-seeding / reset

`npm run seed` (from `server/`) clears and reloads the 12 clients, IC-training rows,
and the admin + per-client accounts. Run it against whichever database is configured
(SQLite by default, or Postgres when `DATABASE_URL` is set).
