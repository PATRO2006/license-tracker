import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initDb, USE_PG, getClients, getClient, getRequests, getHistory, getTraining,
  getUserByLogin, getUserById, getRequestById,
  insertClient, insertUser, insertRequest, insertHistory, insertTraining, deleteClientCascade,
  updateRequestStatus, bumpClientTotal, updateUserPassword, updateClientFields,
  bumpTrainingOrdered, updateRequestFields,
  insertOnboarding, getOnboardingsForClient,
  getReportRowsForClient, replaceReportRowsForClient, getReportCompletedTotal,
} from './db.js';
import { enrichClient, buildDashboard } from './logic.js';
import { buildReportStats } from './trainingReport.js';
import {
  sendRequestNotification, sendDecisionNotification, sendOnboardingNotification,
  sendUserOnboardingNotification, sendBulkOnboardingNotification, readOutbox,
} from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const newId = (p) => `${p}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const today = () => new Date().toISOString().slice(0, 10);

await initDb();
if ((await getClients()).length === 0) {
  const { seedDatabase } = await import('./seed.js');
  await seedDatabase();
  console.log(`Database seeded (${USE_PG ? 'PostgreSQL' : 'SQLite'}).`);
} else {
  console.log(`Database ready (${USE_PG ? 'PostgreSQL' : 'SQLite'}).`);
}

// ---------- Auth helpers ----------
const makeToken = (user) => Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, clientId: u.clientId, initials: u.initials });

async function authRequired(req, res, next) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  let userId;
  try { userId = Buffer.from(token, 'base64').toString('utf-8').split(':')[0]; }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
  const user = await getUserById(userId);
  if (!user) return res.status(401).json({ error: 'Invalid session' });
  req.user = user;
  next();
}
const adminOnly = (req, res, next) =>
  req.user.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only' });
const canAccessClient = (user, clientId) => user.role === 'admin' || user.clientId === clientId;

async function withHistory(enriched) {
  const h = await getHistory();
  enriched.history = h.filter((x) => x.clientId === enriched.id).sort((a, b) => (a.date < b.date ? 1 : -1));
  enriched.onboardings = await getOnboardingsForClient(enriched.id);
  return enriched;
}

// ---------- Login / account ----------
app.post('/api/login', async (req, res) => {
  const { email, username, identifier, password } = req.body || {};
  const id = identifier || username || email || '';
  const user = await getUserByLogin(id);
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: makeToken(user), user: publicUser(user) });
});

app.get('/api/me', authRequired, (req, res) => res.json(publicUser(req.user)));

// Self-service password change (any logged-in user).
app.post('/api/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  if (!bcrypt.compareSync(currentPassword || '', req.user.passwordHash)) {
    return res.status(403).json({ error: 'Current password is incorrect' });
  }
  await updateUserPassword(req.user.id, bcrypt.hashSync(newPassword, 10));
  res.json({ ok: true });
});

// ---------- Dashboard ----------
app.get('/api/dashboard', authRequired, async (req, res) => {
  const [requests, training] = [await getRequests(), await getTraining()];
  if (req.user.role === 'admin') {
    return res.json({ role: 'admin', ...buildDashboard(await getClients(), requests, training) });
  }
  const client = await getClient(req.user.clientId);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ role: 'client', client: await withHistory(enrichClient(client, requests, training)) });
});

// ---------- Clients ----------
app.get('/api/clients', authRequired, async (req, res) => {
  const [requests, training] = [await getRequests(), await getTraining()];
  const source = req.user.role === 'admin' ? await getClients() : [await getClient(req.user.clientId)].filter(Boolean);
  res.json(source.map((c) => enrichClient(c, requests, training)));
});

app.get('/api/clients/:id', authRequired, async (req, res) => {
  if (!canAccessClient(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const client = await getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(await withHistory(enrichClient(client, await getRequests(), await getTraining())));
});

// Admin: register a new client AND auto-create its login.
app.post('/api/clients', authRequired, adminOnly, async (req, res) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name is required' });
  // Both Employee Training and IC Training must be provided when adding a client.
  if (b.totalPurchased === undefined || b.totalPurchased === '' || b.icOrdered === undefined || b.icOrdered === '') {
    return res.status(400).json({ error: 'Employee Training and IC Training counts are both required' });
  }
  const id = slugify(b.name);
  if (await getClient(id)) return res.status(409).json({ error: 'A client with that name already exists' });

  const total = Number(b.totalPurchased || 0);
  await insertClient({
    id, name: b.name, contact: b.contact || null, contactEmail: b.contactEmail || null,
    contractStart: b.contractStart || null, contractEnd: b.contractEnd || null,
    renewalDate: b.renewalDate || null, sharedOn: b.sharedOn || today(),
    totalPurchased: total, activeLicenses: Number(b.activeLicenses || 0),
    pendingLicenses: Number(b.pendingLicenses || 0), trainingCompleted: Number(b.trainingCompleted || 0),
    deactivated: 0, deactivatedDetail: null, complimentary: b.complimentary ? 1 : 0,
    licenseThreshold: Math.max(3, Math.round(total * 0.1)), notes: b.notes || '',
  });
  await insertHistory({
    id: newId('h'), clientId: id, date: today(), action: 'allocation',
    detail: `Initial allocation of ${total} licenses`, changedBy: req.user.name, licenseDelta: total,
  });
  // IC Training row (created alongside the client).
  await insertTraining({
    clientId: id, ordered: Number(b.icOrdered || 0), used: Number(b.icUsed || 0),
    trainingCompleted: Number(b.icCompleted || 0), date: b.sharedOn || today(),
  });

  const initials = b.name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const password = b.password && b.password.length >= 6 ? b.password : `${b.name.replace(/[^A-Za-z0-9]/g, '')}@2026`;
  await insertUser({
    id: `u-${id}`, name: b.name, username: id, email: b.contactEmail || null,
    passwordHash: bcrypt.hashSync(password, 10), role: 'client', clientId: id, initials,
  });

  const created = await getClient(id);
  res.status(201).json({
    client: enrichClient(created, await getRequests(), await getTraining()),
    credentials: { username: id, password },
  });
  // Onboarding notification → tech.support@ (background, non-blocking)
  sendOnboardingNotification({ client: created }).catch((e) => console.error('[email] onboarding', e.message));
});

// Admin: edit client fields (incl. contract dates → enables expiry monitoring).
app.patch('/api/clients/:id', authRequired, adminOnly, async (req, res) => {
  const client = await getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const b = req.body || {};
  const allowed = ['contact', 'contactEmail', 'contractStart', 'contractEnd', 'renewalDate', 'sharedOn',
    'totalPurchased', 'activeLicenses', 'pendingLicenses', 'trainingCompleted', 'deactivated', 'deactivatedDetail', 'notes'];
  const fields = {};
  for (const k of allowed) if (k in b) fields[k] = b[k] === '' ? null : b[k];
  if ('totalPurchased' in fields) fields.licenseThreshold = Math.max(3, Math.round(Number(fields.totalPurchased) * 0.1));
  await updateClientFields(req.params.id, fields);
  res.json(enrichClient(await getClient(req.params.id), await getRequests(), await getTraining()));
});

// Admin: delete a client and all associated data.
app.delete('/api/clients/:id', authRequired, adminOnly, async (req, res) => {
  const client = await getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  await deleteClientCascade(req.params.id);
  res.json({ ok: true, deleted: req.params.id });
});

// ---------- Requests ----------
app.get('/api/requests', authRequired, async (req, res) => {
  let rows = await getRequests();
  if (req.user.role !== 'admin') rows = rows.filter((r) => r.clientId === req.user.clientId);
  if (req.query.status) rows = rows.filter((r) => r.status === req.query.status);
  res.json(rows.sort((a, b) => (a.requestDate < b.requestDate ? 1 : -1)));
});

app.post('/api/requests', authRequired, async (req, res) => {
  const b = req.body || {};
  const clientId = req.user.role === 'admin' ? b.clientId : req.user.clientId;
  const client = await getClient(clientId);
  if (!client) return res.status(400).json({ error: 'Unknown client' });

  const category = b.category === 'ic' ? 'ic' : 'employee';
  const request = {
    id: newId('r'), clientId, type: b.type || 'additional', category,
    requestedCount: Number(b.requestedCount || 0), currentCount: client.totalPurchased,
    details: b.details || '', status: 'Pending', requestDate: today(), completionDate: null,
  };
  await insertRequest(request);

  // Respond immediately, then send the notification in the background so a
  // slow/blocked SMTP connection can never wedge the request submission.
  res.status(201).json({ request, emailQueued: true });
  sendRequestNotification({ client, request }).catch((e) => console.error('[email]', e.message));
});

// Admin only. Two modes:
//   • Edit a pending request's count/details (no `status` in body)
//   • Change status (approve/reject/complete) — approval adds the licenses
app.patch('/api/requests/:id', authRequired, adminOnly, async (req, res) => {
  const request = await getRequestById(req.params.id);
  if (!request) return res.status(404).json({ error: 'Request not found' });
  const b = req.body || {};

  // ----- Edit mode -----
  if (!('status' in b) && ('requestedCount' in b || 'details' in b)) {
    if (request.status !== 'Pending') return res.status(400).json({ error: 'Only pending requests can be edited' });
    const fields = {};
    if ('requestedCount' in b) fields.requestedCount = Number(b.requestedCount);
    if ('details' in b) fields.details = b.details;
    await updateRequestFields(request.id, fields);
    return res.json({ ...request, ...fields });
  }

  // ----- Status mode -----
  const next = b.status;
  if (!['Pending', 'Approved', 'Rejected', 'Completed'].includes(next)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const completionDate = next === 'Pending' ? null : today();
  await updateRequestStatus(request.id, next, completionDate);

  // On APPROVAL, the requested licenses are added to the system immediately.
  if (next === 'Approved' && request.type !== 'renewal') {
    if (request.category === 'ic') {
      await bumpTrainingOrdered(request.clientId, request.requestedCount);
      await insertHistory({
        id: newId('h'), clientId: request.clientId, date: completionDate, action: 'purchase',
        detail: `Request ${request.id} approved — added ${request.requestedCount} IC Training seats`,
        changedBy: req.user.name, licenseDelta: request.requestedCount,
      });
    } else {
      await bumpClientTotal(request.requestedCount, request.clientId);
      await insertHistory({
        id: newId('h'), clientId: request.clientId, date: completionDate, action: 'purchase',
        detail: `Request ${request.id} approved — added ${request.requestedCount} licenses`,
        changedBy: req.user.name, licenseDelta: request.requestedCount,
      });
    }
  } else if (next === 'Approved' && request.type === 'renewal') {
    await insertHistory({
      id: newId('h'), clientId: request.clientId, date: completionDate, action: 'renewal',
      detail: `Renewal request ${request.id} approved`, changedBy: req.user.name, licenseDelta: 0,
    });
  }

  res.json({ ...request, status: next, completionDate });
  // Notify the client of the decision (background, non-blocking).
  if (['Approved', 'Rejected', 'Completed'].includes(next)) {
    getClient(request.clientId)
      .then((client) => sendDecisionNotification({ client, request, decision: next }))
      .catch((e) => console.error('[email] decision', e.message));
  }
});

// ---------- Onboarding (a client onboards a new user) ----------
// Captures the user's details and emails tech.support@. No license change.
app.post('/api/onboard', authRequired, async (req, res) => {
  const b = req.body || {};
  const clientId = req.user.role === 'admin' ? b.clientId : req.user.clientId;
  const client = await getClient(clientId);
  if (!client) return res.status(400).json({ error: 'Unknown client' });
  if (!b.username && !b.email) return res.status(400).json({ error: 'username or email is required' });

  const onboarding = {
    id: newId('ob'), clientId,
    username: b.username || null, firstName: b.firstName || null, lastName: b.lastName || null,
    email: b.email || null, institution: b.institution || null, joiningDate: b.joiningDate || null,
    userType: b.userType === 'Coach' ? 'Coach' : 'Employee', createdAt: today(),
  };
  await insertOnboarding(onboarding);

  res.status(201).json({ onboarding, emailed: true });
  sendUserOnboardingNotification({ client, onboarding }).catch((e) => console.error('[email] onboarding-user', e.message));
});

// Onboard MULTIPLE users at once. Body: { users: [{username,firstName,lastName,email,joiningDate}, ...] }
app.post('/api/onboard-bulk', authRequired, async (req, res) => {
  const b = req.body || {};
  const list = Array.isArray(b.users) ? b.users.filter((u) => u && (u.username || u.email)) : [];
  if (list.length === 0) return res.status(400).json({ error: 'No valid users provided (need username or email)' });
  // Resolve the target client: clients onboard for themselves; admins target a
  // client via top-level clientId or per-user clientId.
  const clientId = req.user.role === 'admin' ? (b.clientId || list[0].clientId) : req.user.clientId;
  const client = await getClient(clientId);
  if (!client) return res.status(400).json({ error: 'Unknown client' });

  const created = [];
  for (const u of list) {
    const onboarding = {
      id: newId('ob'), clientId,
      username: u.username || null, firstName: u.firstName || null, lastName: u.lastName || null,
      email: u.email || null, institution: u.institution || null, joiningDate: u.joiningDate || null,
      userType: u.userType === 'Coach' ? 'Coach' : 'Employee', createdAt: today(),
    };
    await insertOnboarding(onboarding);
    created.push(onboarding);
  }

  res.status(201).json({ count: created.length, emailed: true });
  sendBulkOnboardingNotification({ client, onboardings: created }).catch((e) => console.error('[email] onboarding-bulk', e.message));
});

app.get('/api/onboardings', authRequired, async (req, res) => {
  const clientId = req.user.role === 'admin' ? (req.query.clientId || null) : req.user.clientId;
  if (!clientId) {
    // admin, no filter → all
    const { getOnboardings } = await import('./db.js');
    return res.json(await getOnboardings());
  }
  res.json(await getOnboardingsForClient(clientId));
});

// ---------- Training report (per client) ----------
// View a client's report — admin, or that client for their own.
// ?type=employee|coach — a client can hold separate reports (Fittr).
const reportType = (req) => (req.query.type === 'coach' ? 'coach' : 'employee');

app.get('/api/clients/:id/report', authRequired, async (req, res) => {
  if (!canAccessClient(req.user, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  res.json(buildReportStats(await getReportRowsForClient(req.params.id, reportType(req))));
});

// Admin uploads a client's report (replaces it). Body: { rows: [{name,email,status,date}] }
app.post('/api/clients/:id/report', authRequired, adminOnly, async (req, res) => {
  const client = await getClient(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows || rows.length === 0) return res.status(400).json({ error: 'No rows provided' });
  const type = reportType(req);
  await replaceReportRowsForClient(req.params.id, rows.map((r) => ({ name: r.name || '', email: r.email || '', status: r.status || '', date: r.date || '' })), type);
  const stats = buildReportStats(await getReportRowsForClient(req.params.id, type));
  // Keep the client's "Training Completed" figure in sync with the uploaded
  // reports (Completed users across all report types).
  await updateClientFields(req.params.id, { trainingCompleted: await getReportCompletedTotal(req.params.id) });
  res.json(stats);
});

// ---------- Misc ----------
app.get('/api/outbox', authRequired, adminOnly, async (req, res) => res.json(readOutbox()));
app.get('/api/health', (req, res) => res.json({ ok: true }));

const CLIENT_DIST = path.resolve(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
}

app.listen(PORT, () => console.log(`License Tracking System listening on http://localhost:${PORT}`));
