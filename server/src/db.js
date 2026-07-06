// Dual-backend data layer (async).
//   • If DATABASE_URL is set  → PostgreSQL (via `pg`) — persists for free on Neon.
//   • Otherwise               → SQLite (via sql.js) — single file, zero setup.
// The same async query helpers back both, so the rest of the app doesn't care
// which database is in use.
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'license-tracker.db');

export const USE_PG = !!process.env.DATABASE_URL;
let pool = null;       // pg pool
let database = null;   // sql.js db

// Convert `?` placeholders to Postgres `$1, $2, …`
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Postgres folds unquoted identifiers to lowercase, so rows come back with
// lowercase keys (passwordhash, clientid, …). Map them back to the camelCase
// the app expects. (SQLite preserves the original casing, so this is PG-only.)
const PG_KEYMAP = {
  passwordhash: 'passwordHash', contactemail: 'contactEmail', contractstart: 'contractStart',
  contractend: 'contractEnd', renewaldate: 'renewalDate', sharedon: 'sharedOn',
  totalpurchased: 'totalPurchased', activelicenses: 'activeLicenses', pendinglicenses: 'pendingLicenses',
  trainingcompleted: 'trainingCompleted', deactivateddetail: 'deactivatedDetail',
  licensethreshold: 'licenseThreshold', clientid: 'clientId', requestedcount: 'requestedCount',
  currentcount: 'currentCount', requestdate: 'requestDate', completiondate: 'completionDate',
  licensedelta: 'licenseDelta', changedby: 'changedBy',
  firstname: 'firstName', lastname: 'lastName', joiningdate: 'joiningDate', createdat: 'createdAt',
};
function remapRow(row) {
  const out = {};
  for (const k in row) out[PG_KEYMAP[k] || k] = row[k];
  return out;
}

export async function initDb() {
  if (USE_PG) {
    const Pg = (await import('pg')).default;
    pool = new Pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await createSchema('pg');
  } else {
    const SQL = await initSqlJs();
    fs.mkdirSync(DATA_DIR, { recursive: true });
    database = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
    await createSchema('sqlite');
  }
  await migrate();
}

// Schema migrations for databases created before a column existed.
// Each ALTER is run independently and ignored if it fails (column already there).
async function migrate() {
  const alters = [
    USE_PG
      ? `ALTER TABLE requests ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'employee'`
      : `ALTER TABLE requests ADD COLUMN category TEXT DEFAULT 'employee'`,
    USE_PG
      ? `ALTER TABLE onboardings ADD COLUMN IF NOT EXISTS institution TEXT`
      : `ALTER TABLE onboardings ADD COLUMN institution TEXT`,
  ];
  for (const a of alters) {
    try {
      if (USE_PG) await pool.query(a);
      else database.run(a);
    } catch { /* column already exists */ }
  }
  if (!USE_PG) persist();
}

function persist() {
  if (USE_PG) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, Buffer.from(database.export()));
}

// ---- query helpers ----
export async function all(sql, params = []) {
  if (USE_PG) {
    const res = await pool.query(toPg(sql), params);
    return res.rows.map(remapRow);
  }
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
export async function get(sql, params = []) {
  return (await all(sql, params))[0] || null;
}
export async function run(sql, params = []) {
  if (USE_PG) {
    await pool.query(toPg(sql), params);
    return;
  }
  database.run(sql, params);
  persist();
}
export async function execRaw(stmts) {
  // stmts: array of individual SQL statements (no params)
  for (const s of stmts) {
    if (!s.trim()) continue;
    if (USE_PG) await pool.query(s);
    else database.run(s);
  }
  persist();
}

async function createSchema(kind) {
  const auto = kind === 'pg' ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const stmts = [
    `CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT, contactEmail TEXT,
      contractStart TEXT, contractEnd TEXT, renewalDate TEXT, sharedOn TEXT,
      totalPurchased INTEGER DEFAULT 0, activeLicenses INTEGER DEFAULT 0,
      pendingLicenses INTEGER DEFAULT 0, trainingCompleted INTEGER DEFAULT 0,
      deactivated INTEGER DEFAULT 0, deactivatedDetail TEXT,
      complimentary INTEGER DEFAULT 0, licenseThreshold INTEGER DEFAULT 5, notes TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS training (
      id ${auto}, clientId TEXT NOT NULL,
      ordered INTEGER DEFAULT 0, used INTEGER DEFAULT 0,
      trainingCompleted INTEGER DEFAULT 0, date TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY, clientId TEXT NOT NULL, type TEXT, category TEXT DEFAULT 'employee',
      requestedCount INTEGER DEFAULT 0, currentCount INTEGER DEFAULT 0, details TEXT,
      status TEXT DEFAULT 'Pending', requestDate TEXT, completionDate TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY, clientId TEXT NOT NULL, date TEXT, action TEXT,
      detail TEXT, changedBy TEXT, licenseDelta INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE, email TEXT,
      passwordHash TEXT NOT NULL, role TEXT NOT NULL, clientId TEXT, initials TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS onboardings (
      id TEXT PRIMARY KEY, clientId TEXT NOT NULL, username TEXT, firstName TEXT,
      lastName TEXT, email TEXT, institution TEXT, joiningDate TEXT, createdAt TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS training_report (
      id ${auto}, name TEXT, email TEXT, status TEXT, date TEXT
    )`,
  ];
  await execRaw(stmts);
}

// ---------- Reads ----------
export const getClients = () => all('SELECT * FROM clients ORDER BY name');
export const getClient = (id) => get('SELECT * FROM clients WHERE id = ?', [id]);
export const getRequests = () => all('SELECT * FROM requests');
export const getHistory = () => all('SELECT * FROM history');
export const getTraining = () => all('SELECT * FROM training');
export const getUserByLogin = (id) =>
  get('SELECT * FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?)', [id, id]);
export const getUserById = (id) => get('SELECT * FROM users WHERE id = ?', [id]);
export const getRequestById = (id) => get('SELECT * FROM requests WHERE id = ?', [id]);
export const getReportRows = () => all('SELECT name, email, status, date FROM training_report ORDER BY id');
export const replaceReportRows = async (rows) => {
  await run('DELETE FROM training_report');
  for (const r of rows) {
    await run('INSERT INTO training_report (name,email,status,date) VALUES (?,?,?,?)',
      [r.name || '', r.email || '', r.status || '', r.date || '']);
  }
};
export const getOnboardings = () => all('SELECT * FROM onboardings');
export const getOnboardingsForClient = (clientId) =>
  all('SELECT * FROM onboardings WHERE clientId = ? ORDER BY createdAt DESC', [clientId]);

// ---------- Writes ----------
export const insertClient = (c) => run(
  `INSERT INTO clients (id,name,contact,contactEmail,contractStart,contractEnd,renewalDate,sharedOn,
    totalPurchased,activeLicenses,pendingLicenses,trainingCompleted,deactivated,deactivatedDetail,
    complimentary,licenseThreshold,notes)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  [c.id, c.name, c.contact, c.contactEmail, c.contractStart, c.contractEnd, c.renewalDate, c.sharedOn,
   c.totalPurchased, c.activeLicenses, c.pendingLicenses, c.trainingCompleted, c.deactivated,
   c.deactivatedDetail, c.complimentary, c.licenseThreshold, c.notes]
);
export const insertTraining = (t) => run(
  'INSERT INTO training (clientId,ordered,used,trainingCompleted,date) VALUES (?,?,?,?,?)',
  [t.clientId, t.ordered, t.used, t.trainingCompleted, t.date]
);
export const insertRequest = (r) => run(
  `INSERT INTO requests (id,clientId,type,category,requestedCount,currentCount,details,status,requestDate,completionDate)
   VALUES (?,?,?,?,?,?,?,?,?,?)`,
  [r.id, r.clientId, r.type, r.category || 'employee', r.requestedCount, r.currentCount, r.details, r.status, r.requestDate, r.completionDate]
);
// Add ordered IC-training seats to a client (creates a training row if none exists).
export const bumpTrainingOrdered = async (clientId, delta) => {
  const existing = await get('SELECT id FROM training WHERE clientId = ?', [clientId]);
  if (existing) await run('UPDATE training SET ordered = ordered + ? WHERE clientId = ?', [delta, clientId]);
  else await run('INSERT INTO training (clientId,ordered,used,trainingCompleted,date) VALUES (?,?,?,?,?)', [clientId, delta, 0, 0, null]);
};
export const updateRequestFields = (id, fields) => {
  const cols = Object.keys(fields);
  if (cols.length === 0) return Promise.resolve();
  const set = cols.map((c) => `${c} = ?`).join(', ');
  return run(`UPDATE requests SET ${set} WHERE id = ?`, [...cols.map((c) => fields[c]), id]);
};
export const insertHistory = (h) => run(
  'INSERT INTO history (id,clientId,date,action,detail,changedBy,licenseDelta) VALUES (?,?,?,?,?,?,?)',
  [h.id, h.clientId, h.date, h.action, h.detail, h.changedBy, h.licenseDelta]
);
export const insertUser = (u) => run(
  'INSERT INTO users (id,name,username,email,passwordHash,role,clientId,initials) VALUES (?,?,?,?,?,?,?,?)',
  [u.id, u.name, u.username, u.email, u.passwordHash, u.role, u.clientId, u.initials]
);
export const insertOnboarding = (o) => run(
  'INSERT INTO onboardings (id,clientId,username,firstName,lastName,email,institution,joiningDate,createdAt) VALUES (?,?,?,?,?,?,?,?,?)',
  [o.id, o.clientId, o.username, o.firstName, o.lastName, o.email, o.institution, o.joiningDate, o.createdAt]
);
export const updateRequestStatus = (id, status, completionDate) =>
  run('UPDATE requests SET status = ?, completionDate = ? WHERE id = ?', [status, completionDate, id]);
export const bumpClientTotal = (delta, id) =>
  run('UPDATE clients SET totalPurchased = totalPurchased + ? WHERE id = ?', [delta, id]);
export const updateUserPassword = (id, passwordHash) =>
  run('UPDATE users SET passwordHash = ? WHERE id = ?', [passwordHash, id]);
export const updateClientFields = (id, fields) => {
  const cols = Object.keys(fields);
  if (cols.length === 0) return Promise.resolve();
  const set = cols.map((c) => `${c} = ?`).join(', ');
  return run(`UPDATE clients SET ${set} WHERE id = ?`, [...cols.map((c) => fields[c]), id]);
};
export const setClientContactEmail = (id, email) =>
  run('UPDATE clients SET contactEmail = ? WHERE id = ?', [email, id]);
