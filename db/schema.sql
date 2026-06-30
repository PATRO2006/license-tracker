-- License Tracking System — database schema (PostgreSQL)
--
-- NOTE: The application creates these tables automatically on first boot
-- (see server/src/db.js → createSchema). Running this script manually is only
-- needed if you want to pre-provision a fresh database before the app starts,
-- or set it up on a separate Postgres instance.
--
-- Identifiers are intentionally unquoted, so PostgreSQL folds them to
-- lowercase. The app maps them back to camelCase on read (db.js → remapRow),
-- so this script matches exactly what the app expects.

CREATE TABLE IF NOT EXISTS clients (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  contact            TEXT,
  contactEmail       TEXT,
  contractStart      TEXT,
  contractEnd        TEXT,
  renewalDate        TEXT,
  sharedOn           TEXT,
  totalPurchased     INTEGER DEFAULT 0,
  activeLicenses     INTEGER DEFAULT 0,
  pendingLicenses    INTEGER DEFAULT 0,
  trainingCompleted  INTEGER DEFAULT 0,
  deactivated        INTEGER DEFAULT 0,
  deactivatedDetail  TEXT,
  complimentary      INTEGER DEFAULT 0,
  licenseThreshold   INTEGER DEFAULT 5,
  notes              TEXT
);

CREATE TABLE IF NOT EXISTS training (
  id                 SERIAL PRIMARY KEY,
  clientId           TEXT NOT NULL,
  ordered            INTEGER DEFAULT 0,
  used               INTEGER DEFAULT 0,
  trainingCompleted  INTEGER DEFAULT 0,
  date               TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  id                 TEXT PRIMARY KEY,
  clientId           TEXT NOT NULL,
  type               TEXT,
  category           TEXT DEFAULT 'employee',   -- 'employee' (main licenses) | 'ic' (IC Training)
  requestedCount     INTEGER DEFAULT 0,
  currentCount       INTEGER DEFAULT 0,
  details            TEXT,
  status             TEXT DEFAULT 'Pending',    -- Pending | Approved | Rejected | Completed
  requestDate        TEXT,
  completionDate     TEXT
);

CREATE TABLE IF NOT EXISTS history (
  id                 TEXT PRIMARY KEY,
  clientId           TEXT NOT NULL,
  date               TEXT,
  action             TEXT,                      -- allocation | purchase | renewal | modification | extension
  detail             TEXT,
  changedBy          TEXT,
  licenseDelta       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  username           TEXT UNIQUE,
  email              TEXT,
  passwordHash       TEXT NOT NULL,
  role               TEXT NOT NULL,             -- 'admin' | 'client'
  clientId           TEXT,
  initials           TEXT
);
