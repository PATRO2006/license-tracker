// Seeds the SQLite database with the REAL client data from the
// "License utilisation tracker" sheet, the IC Training rows, and the user
// accounts (admin + one per client). Idempotent: clears and re-inserts.
//
// Only data provided in the sheet/Slack is used. Contract start/end dates were
// not provided, so they are left null (health is driven by utilization).

import bcrypt from 'bcryptjs';
import {
  initDb, execRaw, getClients, insertClient, insertTraining, insertUser,
} from './db.js';

const threshold = (ordered) => Math.max(3, Math.round(ordered * 0.1));

// Default password per client: NameWithoutSpaces + "@2026"
const defaultPassword = (name) => `${name.replace(/[^A-Za-z0-9]/g, '')}@2026`;
const initials = (name) =>
  name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// ---- Real client data (from the utilisation tracker) ----
const clients = [
  { id: 'fittr', name: 'Fittr', contact: 'Priyanka Salvi', totalPurchased: 450, activeLicenses: 317, pendingLicenses: 133, trainingCompleted: 97, sharedOn: '2025-10-10', deactivated: 6, deactivatedDetail: '2 + 3 (3 Jan) + 1 (March)', complimentary: 0, notes: '' },
  { id: 'gsp-crop', name: 'GSP Crop', contact: 'Ankita Maheshwari', totalPurchased: 25, activeLicenses: 19, pendingLicenses: 6, trainingCompleted: 14, sharedOn: '2025-09-10', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: '' },
  { id: 'machaxi', name: 'Machaxi', contact: '', totalPurchased: 200, activeLicenses: 196, pendingLicenses: 4, trainingCompleted: 100, sharedOn: '2025-09-19', deactivated: 12, deactivatedDetail: '12', complimentary: 0, notes: '' },
  { id: 'biopeak', name: 'Biopeak', contact: 'Alia Abreo', totalPurchased: 22, activeLicenses: 34, pendingLicenses: -12, trainingCompleted: 20, sharedOn: '2025-10-07', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: 'Usage exceeds ordered licenses.' },
  { id: 'alter', name: 'Alter', contact: 'HR Department, Alter', totalPurchased: 60, activeLicenses: 53, pendingLicenses: 7, trainingCompleted: 37, sharedOn: '2025-12-18', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: '' },
  { id: 'tech-japan', name: 'Tech Japan', contact: 'sheenu.diwan', totalPurchased: 94, activeLicenses: 47, pendingLicenses: 47, trainingCompleted: 21, sharedOn: '2025-12-09', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: '' },
  { id: 'quantana', name: 'Quantana', contact: 'Bharathi Chintala', totalPurchased: 88, activeLicenses: 89, pendingLicenses: -1, trainingCompleted: 71, sharedOn: '2025-12-19', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: 'Usage exceeds ordered licenses.' },
  { id: 'invarsys', name: 'Invarsys', contact: 'Shruti Tiwari', totalPurchased: 60, activeLicenses: 57, pendingLicenses: 3, trainingCompleted: 52, sharedOn: '2026-02-24', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: '' },
  { id: 'sunfan', name: 'Sunfan', contact: 'Kolpo Sunfan', totalPurchased: 60, activeLicenses: 6, pendingLicenses: 54, trainingCompleted: 5, sharedOn: '2026-03-03', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: '' },
  { id: 'technip', name: 'Technip', contact: '', totalPurchased: 3, activeLicenses: 3, pendingLicenses: 0, trainingCompleted: 1, sharedOn: '2026-03-26', deactivated: 0, deactivatedDetail: null, complimentary: 1, notes: 'Complimentary licenses.' },
  { id: 'emergence', name: 'Emergence', contact: '', totalPurchased: 55, activeLicenses: 29, pendingLicenses: 0, trainingCompleted: 24, sharedOn: '2026-05-11', deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: '' },
  { id: 'endor-labs', name: 'Endor Labs', contact: '', totalPurchased: 8, activeLicenses: 2, pendingLicenses: 0, trainingCompleted: 0, sharedOn: null, deactivated: 0, deactivatedDetail: null, complimentary: 0, notes: '' },
];

// ---- IC Training rows ----
const training = [
  { clientId: 'tech-japan', ordered: 3, used: 0, trainingCompleted: 0, date: null },
  { clientId: 'quantana', ordered: 6, used: 6, trainingCompleted: 5, date: '2025-12-19' },
  { clientId: 'emergence', ordered: 5, used: 5, trainingCompleted: 0, date: null },
];

export async function seedDatabase() {
  await execRaw([
    'DELETE FROM training', 'DELETE FROM history', 'DELETE FROM requests',
    'DELETE FROM users', 'DELETE FROM clients',
  ]);

  for (const c of clients) {
    await insertClient({
      id: c.id, name: c.name, contact: c.contact || null, contactEmail: null,
      contractStart: null, contractEnd: null, renewalDate: null, sharedOn: c.sharedOn,
      totalPurchased: c.totalPurchased, activeLicenses: c.activeLicenses,
      pendingLicenses: c.pendingLicenses, trainingCompleted: c.trainingCompleted,
      deactivated: c.deactivated, deactivatedDetail: c.deactivatedDetail,
      complimentary: c.complimentary, licenseThreshold: threshold(c.totalPurchased), notes: c.notes,
    });
  }
  for (const t of training) await insertTraining(t);

  await insertUser({
    id: 'u-admin', name: 'Admin', username: null, email: 'support@safespacesinc.in',
    passwordHash: bcrypt.hashSync('Admin@2026', 10), role: 'admin', clientId: null, initials: 'AD',
  });
  for (const c of clients) {
    await insertUser({
      id: `u-${c.id}`, name: c.name, username: c.id, email: null,
      passwordHash: bcrypt.hashSync(defaultPassword(c.name), 10),
      role: 'client', clientId: c.id, initials: initials(c.name),
    });
  }

  console.log(`Seeded ${clients.length} clients, ${training.length} IC-training rows, ${clients.length + 1} users.`);
}

// Run standalone: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  await initDb();
  if ((await getClients()).length) console.log('(re-seeding; existing data will be replaced)');
  await seedDatabase();
  console.log('\nAdmin login: support@safespacesinc.in / Admin@2026');
  console.log('Client logins:');
  for (const c of clients) console.log(`  ${c.id.padEnd(12)} / ${defaultPassword(c.name)}`);
}
