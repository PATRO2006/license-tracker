// Email notification service.
// Uses real SMTP when configured via env vars; otherwise falls back to an
// "outbox" file (server/data/outbox.json) + console log so the workflow is
// fully demonstrable without credentials.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTBOX_PATH = path.join(__dirname, '..', 'data', 'outbox.json');

// Recipients:
//   • License requests (Employee Training)      → support@safespacesinc.in
//   • Onboarding (IC Training + new clients)     → tech.support@safespacesinc.in
const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'support@safespacesinc.in';
const ONBOARDING_TO = process.env.ONBOARDING_EMAIL || 'tech.support@safespacesinc.in';
const FROM = process.env.SMTP_FROM || 'license-tracker@example.com';

let transporter = null;
if (process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    // Fail fast instead of hanging if the SMTP port is blocked/unreachable
    // (some hosts block 465/587). These caps ensure sendMail rejects quickly
    // and we log a real error rather than leaving a request wedged.
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

function appendOutbox(message) {
  let outbox = [];
  if (fs.existsSync(OUTBOX_PATH)) {
    try {
      outbox = JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf-8'));
    } catch {
      outbox = [];
    }
  }
  outbox.unshift(message);
  fs.mkdirSync(path.dirname(OUTBOX_PATH), { recursive: true });
  fs.writeFileSync(OUTBOX_PATH, JSON.stringify(outbox, null, 2));
}

function renderBody({ client, request }) {
  return [
    `A license request requires your attention.`,
    ``,
    `Client Name:            ${client.name}`,
    `Request For:            ${request.category === 'ic' ? 'IC Training' : 'Employee Training'}`,
    `Request Date:           ${request.requestDate}`,
    `Requested Count:        ${request.requestedCount}`,
    `Current License Count:  ${request.currentCount}`,
    `Request Type:           ${request.type}`,
    `Request Status:         ${request.status}`,
    ``,
    `Request Details:`,
    `${request.details}`,
    ``,
    `— License Tracking System`,
  ].join('\n');
}

const TYPE_LABEL = {
  new: 'New license request',
  additional: 'Additional license request',
  renewal: 'License renewal/recharge request',
};

export async function sendRequestNotification({ client, request }) {
  // All license requests (Employee Training AND IC Training) go to support@.
  const recipient = NOTIFY_TO;
  const catLabel = request.category === 'ic' ? 'IC Training' : 'Employee Training';
  const subject = `[License Request] ${catLabel} — ${TYPE_LABEL[request.type] || 'request'} — ${client.name}`;
  const text = renderBody({ client, request });

  const message = {
    to: recipient,
    from: FROM,
    subject,
    text,
    sentAt: new Date().toISOString(),
    meta: {
      clientName: client.name,
      requestDate: request.requestDate,
      requestedCount: request.requestedCount,
      currentCount: request.currentCount,
      details: request.details,
      status: request.status,
    },
  };

  if (transporter) {
    await transporter.sendMail(message);
    console.log(`[email] sent to ${recipient}: ${subject}`);
  } else {
    appendOutbox(message);
    console.log(`[email:outbox] queued to ${recipient}: ${subject}`);
  }
  return message;
}

// Sent to tech.support when a NEW client is onboarded (admin "Add client").
export async function sendOnboardingNotification({ client }) {
  const subject = `[Onboarding] New client onboarded — ${client.name}`;
  const text = [
    `A new client has been onboarded into the License Tracking System.`,
    ``,
    `Client Name:      ${client.name}`,
    `Contact Person:   ${client.contact || '—'}`,
    `Contact Email:    ${client.contactEmail || '—'}`,
    `Licenses Ordered: ${client.totalPurchased}`,
    `Onboarded On:     ${client.sharedOn || new Date().toISOString().slice(0, 10)}`,
    ``,
    `— License Tracking System`,
  ].join('\n');

  const message = {
    to: ONBOARDING_TO, from: FROM, subject, text,
    sentAt: new Date().toISOString(),
    meta: { kind: 'onboarding', clientName: client.name },
  };

  if (transporter) {
    await transporter.sendMail(message);
    console.log(`[email] onboarding sent to ${ONBOARDING_TO}: ${subject}`);
  } else {
    appendOutbox(message);
    console.log(`[email:outbox] onboarding queued to ${ONBOARDING_TO}: ${subject}`);
  }
  return message;
}

// Sent to the CLIENT (and CC admin) when a request is approved/rejected/completed.
export async function sendDecisionNotification({ client, request, decision }) {
  const to = client.contactEmail || NOTIFY_TO; // fall back to admin if no client email
  const subject = `Your license request was ${decision} — ${client.name}`;
  const text = [
    `Hello ${client.contact || client.name},`,
    ``,
    `An update on your recent license request:`,
    ``,
    `Client Name:             ${client.name}`,
    `Request Date:            ${request.requestDate}`,
    `Requested License Count: ${request.requestedCount}`,
    `Decision:                ${decision}`,
    decision === 'Completed' ? `New License Total:       ${client.totalPurchased}` : '',
    ``,
    `Request Details:`,
    `${request.details || '—'}`,
    ``,
    `— License Tracking System`,
  ].filter((l) => l !== '').join('\n');

  const message = {
    to, cc: client.contactEmail ? NOTIFY_TO : undefined, from: FROM, subject, text,
    sentAt: new Date().toISOString(),
    meta: { kind: 'decision', clientName: client.name, decision, requestId: request.id },
  };

  if (transporter) {
    await transporter.sendMail(message);
    console.log(`[email] decision sent to ${to}: ${subject}`);
  } else {
    appendOutbox(message);
    console.log(`[email:outbox] decision queued to ${to}: ${subject}`);
  }
  return message;
}

// Sent to tech.support when a CLIENT onboards a new user (no license change).
export async function sendUserOnboardingNotification({ client, onboarding }) {
  const subject = `[Onboarding] New user onboarded — ${client.name}`;
  const text = [
    `A client has onboarded a new user.`,
    ``,
    `Client:        ${client.name}`,
    `Username:      ${onboarding.username || '—'}`,
    `First Name:    ${onboarding.firstName || '—'}`,
    `Last Name:     ${onboarding.lastName || '—'}`,
    `Email:         ${onboarding.email || '—'}`,
    `Institution:   ${onboarding.institution || '—'}`,
    `Joining Date:  ${onboarding.joiningDate || '—'}`,
    ``,
    `— License Tracking System`,
  ].join('\n');

  const message = {
    to: ONBOARDING_TO, from: FROM, subject, text,
    sentAt: new Date().toISOString(),
    meta: { kind: 'user-onboarding', clientName: client.name, username: onboarding.username },
  };

  if (transporter) {
    await transporter.sendMail(message);
    console.log(`[email] user onboarding sent to ${ONBOARDING_TO}: ${subject}`);
  } else {
    appendOutbox(message);
    console.log(`[email:outbox] user onboarding queued to ${ONBOARDING_TO}: ${subject}`);
  }
  return message;
}

// Sent to tech.support when a client onboards MULTIPLE users at once.
export async function sendBulkOnboardingNotification({ client, onboardings }) {
  const subject = `[Onboarding] ${onboardings.length} new user${onboardings.length > 1 ? 's' : ''} onboarded — ${client.name}`;
  const lines = onboardings.map((o, i) => [
    `${i + 1}. ${[o.firstName, o.lastName].filter(Boolean).join(' ') || o.username || '—'}`,
    `   Username: ${o.username || '—'}   Email: ${o.email || '—'}   Institution: ${o.institution || '—'}   Joining: ${o.joiningDate || '—'}`,
  ].join('\n'));
  const text = [
    `A client has onboarded ${onboardings.length} new user(s).`,
    ``,
    `Client: ${client.name}`,
    ``,
    ...lines,
    ``,
    `— License Tracking System`,
  ].join('\n');

  const message = {
    to: ONBOARDING_TO, from: FROM, subject, text,
    sentAt: new Date().toISOString(),
    meta: { kind: 'user-onboarding-bulk', clientName: client.name, count: onboardings.length },
  };

  if (transporter) {
    await transporter.sendMail(message);
    console.log(`[email] bulk onboarding sent to ${ONBOARDING_TO}: ${subject}`);
  } else {
    appendOutbox(message);
    console.log(`[email:outbox] bulk onboarding queued to ${ONBOARDING_TO}: ${subject}`);
  }
  return message;
}

export function readOutbox() {
  if (!fs.existsSync(OUTBOX_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf-8'));
  } catch {
    return [];
  }
}
