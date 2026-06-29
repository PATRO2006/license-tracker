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

// Recipient per requirements: the admin support address.
const NOTIFY_TO = process.env.NOTIFY_EMAIL || 'support@safespacesinc.in';
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
    `Request Date:           ${request.requestDate}`,
    `Requested License Count:${String(request.requestedCount).padStart(5)}`,
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
  const subject = `[License Request] ${TYPE_LABEL[request.type] || 'License request'} — ${client.name}`;
  const text = renderBody({ client, request });

  const message = {
    to: NOTIFY_TO,
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
    console.log(`[email] sent to ${NOTIFY_TO}: ${subject}`);
  } else {
    appendOutbox(message);
    console.log(`[email:outbox] queued to ${NOTIFY_TO}: ${subject}`);
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

export function readOutbox() {
  if (!fs.existsSync(OUTBOX_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(OUTBOX_PATH, 'utf-8'));
  } catch {
    return [];
  }
}
