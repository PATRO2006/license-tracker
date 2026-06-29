// License health + derived-metric logic. Single source of truth for status rules.

export const EXPIRING_SOON_DAYS = 30;

function daysBetween(from, to) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// Status precedence (most urgent first):
//   Expired > Over-utilized > At Capacity > Expiring Soon > Warning > Complimentary > Healthy
// Contract start/end dates were not provided in the source data, so when
// contractEnd is null the date-based statuses (Expired/Expiring Soon) are skipped
// and health is driven by utilization.
export function computeStatus(client, requests, now = new Date()) {
  const total = client.totalPurchased;
  const active = client.activeLicenses;
  const available = total - active;
  const utilization = total > 0 ? active / total : 0;

  let daysToExpiry = null;
  if (client.contractEnd) {
    const today = new Date(now.toISOString().slice(0, 10));
    daysToExpiry = daysBetween(today, client.contractEnd);
  }

  const hasPending = requests.some((r) => r.clientId === client.id && r.status === 'Pending');

  let status;
  if (daysToExpiry !== null && daysToExpiry < 0) status = 'Expired';
  else if (utilization > 1) status = 'Over-utilized';
  else if (utilization >= 0.95) status = 'At Capacity';
  else if (daysToExpiry !== null && daysToExpiry <= EXPIRING_SOON_DAYS) status = 'Expiring Soon';
  else if (available < client.licenseThreshold) status = 'Warning';
  else if (client.complimentary) status = 'Complimentary';
  else status = 'Healthy';

  return {
    status,
    available,
    utilization: Math.round(utilization * 1000) / 10,
    daysToExpiry,
    hasPendingRequest: hasPending,
  };
}

export function enrichClient(client, requests, training = [], now = new Date()) {
  const derived = computeStatus(client, requests, now);
  const clientRequests = requests
    .filter((r) => r.clientId === client.id)
    .sort((a, b) => (a.requestDate < b.requestDate ? 1 : -1));
  const icTraining = training.filter((t) => t.clientId === client.id);
  return {
    ...client,
    ...derived,
    complimentary: !!client.complimentary,
    pendingRequests: clientRequests.filter((r) => r.status === 'Pending').length,
    requests: clientRequests,
    training: icTraining,
  };
}

export function buildDashboard(clients, requests, training, now = new Date()) {
  const enriched = clients.map((c) => enrichClient(c, requests, training, now));
  const sum = (fn) => enriched.reduce((acc, c) => acc + fn(c), 0);

  const healthSummary = enriched.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return {
    totalClients: clients.length,
    totalLicenses: sum((c) => c.totalPurchased),
    activeLicenses: sum((c) => c.activeLicenses),
    availableLicenses: sum((c) => Math.max(0, c.available)),
    pendingRequests: requests.filter((r) => r.status === 'Pending').length,
    pendingLicenses: sum((c) => Math.max(0, c.pendingLicenses || 0)),
    expiringSoon: enriched.filter((c) => c.status === 'Expiring Soon').length,
    expired: enriched.filter((c) => c.status === 'Expired').length,
    overCapacity: enriched.filter((c) => c.status === 'Over-utilized' || c.status === 'At Capacity').length,
    healthSummary,
    clients: enriched,
  };
}
