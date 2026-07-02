import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initDb, USE_PG, getClients, getClient, getRequests, getHistory, getTraining,
  getUserByLogin, getUserById, getRequestById,
  insertClient, insertUser, insertRequest, insertHistory,
  updateRequestStatus, bumpClientTotal, updateUserPassword, updateClientFields,
  bumpTrainingOrdered, updateRequestFields,
  insertOnboarding, getOnboardingsForClient,
} from './db.js';
import { enrichClient, buildDashboard } from './logic.js';
import { getTrainingReport } from './trainingReport.js';
import {
  sendRequestNotification, sendDecisionNotification, sendOnboardingNotification,
  sendUserOnboardingNotification, readOutbox,
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

  const initials = b.name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  const password = b.password && b.password.length >= 6 ? b.password : `${b.name.replace(/[^A-Za-z0-9]/g, '')}@2026`;
  await insertUser({
    id: `u-${id}`, name: b.name, username: id, email: b.contactEmail || null,
    passwordHash: bcrypt.hashSync(password, 10), role: 'client', clientId: id, initials,
  });

  // Onboarding notification → tech.support@
  const created = await getClient(id);
  try { await sendOnboardingNotification({ client: created }); } catch (e) { console.error('[email] onboarding', e.message); }

  res.status(201).json({
    client: enrichClient(created, await getRequests(), await getTraining()),
    credentials: { username: id, password },
  });
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

  let emailQueued = false;
  try { emailQueued = !!(await sendRequestNotification({ client, request })); } catch (e) { console.error('[email]', e.message); }
  res.status(201).json({ request, emailQueued });
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

  // Notify the client of the decision.
  if (['Approved', 'Rejected', 'Completed'].includes(next)) {
    try {
      const client = await getClient(request.clientId);
      await sendDecisionNotification({ client, request, decision: next });
    } catch (e) { console.error('[email] decision', e.message); }
  }
  res.json({ ...request, status: next, completionDate });
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
    email: b.email || null, joiningDate: b.joiningDate || null, createdAt: today(),
  };
  await insertOnboarding(onboarding);

  let emailed = false;
  try { emailed = !!(await sendUserOnboardingNotification({ client, onboarding })); } catch (e) { console.error('[email] onboarding-user', e.message); }
  res.status(201).json({ onboarding, emailed });
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

// ---------- Training report (admin only) ----------
app.get('/api/training-report', authRequired, adminOnly, (req, res) => res.json(getTrainingReport()));

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
