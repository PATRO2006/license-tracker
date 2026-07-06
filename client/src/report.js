// CSV report export. UTF-8 with a BOM so it opens cleanly in Numbers (Mac),
// Excel, and Google Sheets.

function downloadCsv(filename, headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const icTotals = (c) => {
  const ic = c.training || [];
  return {
    ordered: ic.reduce((s, t) => s + (t.ordered || 0), 0),
    used: ic.reduce((s, t) => s + (t.used || 0), 0),
    completed: ic.reduce((s, t) => s + (t.trainingCompleted || 0), 0),
  };
};

const HEADERS = [
  'Client', 'Contact', 'Status',
  'Employee Ordered', 'Employee Used', 'Employee Available', 'Employee Utilization %',
  'IC Ordered', 'IC Used', 'IC Available', 'IC Completed',
  'Training Completed', 'Pending', 'Deactivated', 'Shared On',
];

const rowFor = (c) => {
  const ic = icTotals(c);
  return [
    c.name, c.contact || '', c.status,
    c.totalPurchased, c.activeLicenses, c.available, c.utilization,
    ic.ordered, ic.used, ic.ordered - ic.used, ic.completed,
    c.trainingCompleted, c.pendingLicenses, c.deactivated, c.sharedOn || '',
  ];
};

// All companies' training report (admin).
export function downloadClientsReport(clients) {
  downloadCsv('company-training-report.csv', HEADERS, clients.map(rowFor));
}

// Single client's training report.
export function downloadClientReport(client) {
  const safe = (client.name || 'client').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadCsv(`${safe}-training-report.csv`, HEADERS, [rowFor(client)]);
}

// POSH per-user training progress report (admin).
export function downloadPoshReport(rows) {
  downloadCsv('posh-employee-training.csv', ['Name', 'Email', 'Status', 'Completed On'],
    rows.map((r) => [r.name, r.email, r.status, r.date]));
}

// Onboarded users under a specific client.
export function downloadUsersReport(clientName, onboardings) {
  const safe = (clientName || 'client').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  downloadCsv(`${safe}-users.csv`, ['First Name', 'Last Name', 'Username', 'Email', 'Joining Date', 'Added On'],
    (onboardings || []).map((o) => [o.firstName || '', o.lastName || '', o.username || '', o.email || '', o.joiningDate || '', o.createdAt || '']));
}
