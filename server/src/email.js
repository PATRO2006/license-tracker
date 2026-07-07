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

// Preferred transport: SendGrid's HTTPS API (port 443), because many hosts
// (Render included) block outbound SMTP ports 465/587 — which caused
// "[email] Connection timeout" and nothing reaching SendGrid. The API key is
// read from SENDGRID_API_KEY, or reused from SMTP_PASS when SMTP_USER=apikey.
const SENDGRID_API_KEY =
  process.env.SENDGRID_API_KEY ||
  (process.env.SMTP_USER === 'apikey' ? process.env.SMTP_PASS : null);

// SMTP is kept only as a fallback if no API key is available.
let transporter = null;
if (!SENDGRID_API_KEY && process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// Single delivery path: SendGrid API → SMTP → outbox file. Returns true if the
// message was accepted for delivery (API/SMTP), false if only queued locally.
async function deliver(message) {
  if (SENDGRID_API_KEY) {
    try {
      const personalization = { to: [{ email: message.to }] };
      if (message.cc) personalization.cc = [{ email: message.cc }];
      const payload = {
        personalizations: [personalization],
        from: { email: FROM },
        subject: message.subject,
        content: [{ type: 'text/plain', value: message.text }],
      };
      if (message.attachments?.length) {
        payload.attachments = message.attachments.map((a) => ({
          content: Buffer.from(a.content, 'utf-8').toString('base64'),
          type: a.contentType || 'text/csv',
          filename: a.filename,
          disposition: 'attachment',
        }));
      }
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        console.log(`[email] sent via SendGrid API to ${message.to}: ${message.subject}`);
        return true;
      }
      const body = await res.text();
      console.error(`[email] SendGrid API error ${res.status}: ${body}`);
    } catch (e) {
      console.error('[email] SendGrid API request failed:', e.message);
    }
    // fall through to SMTP/outbox on failure
  }
  if (transporter) {
    await transporter.sendMail(message);
    console.log(`[email] sent via SMTP to ${message.to}: ${message.subject}`);
    return true;
  }
  appendOutbox(message);
  console.log(`[email:outbox] queued to ${message.to}: ${message.subject}`);
  return false;
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

// Build a CSV string (UTF-8 with BOM so it opens cleanly in Excel/Numbers).
function toCsv(headers, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

function renderBody({ client, request }) {
  return [
    `LICENSE REQUEST`,
    `============================================`,
    ``,
    `A new license request requires your attention.`,
    ``,
    `  Client              ${client.name}`,
    `  Request For         ${request.category === 'ic' ? 'IC Training' : 'Employee Training'}`,
    `  Request Type        ${TYPE_LABEL[request.type] || request.type}`,
    `  Requested Count     +${request.requestedCount}`,
    `  Current Licenses    ${request.currentCount}`,
    `  Request Date        ${request.requestDate}`,
    `  Status              ${request.status}`,
    ``,
    `  Details`,
    `  ${request.details || '—'}`,
    ``,
    `A CSV copy of this request is attached.`,
    `--------------------------------------------`,
    `License Tracking System · Safe Spaces`,
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

  const csv = toCsv(
    ['Client', 'Request For', 'Request Type', 'Requested Count', 'Current Licenses', 'Request Date', 'Status', 'Details'],
    [[client.name, request.category === 'ic' ? 'IC Training' : 'Employee Training', TYPE_LABEL[request.type] || request.type,
      request.requestedCount, request.currentCount, request.requestDate, request.status, request.details || '']],
  );
  const message = {
    to: recipient,
    from: FROM,
    subject,
    text,
    attachments: [{ filename: `license-request-${client.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, content: csv, contentType: 'text/csv' }],
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

  await deliver(message);
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

  await deliver(message);
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

  await deliver(message);
  return message;
}

// Sent to tech.support when a CLIENT onboards a new user (no license change).
export async function sendUserOnboardingNotification({ client, onboarding }) {
  const subject = `[Onboarding] New user onboarded — ${client.name}`;
  const text = [
    `USER ONBOARDING — INFORMATION FOR TECH TEAM`,
    `============================================`,
    ``,
    `${client.name} has onboarded a new user. Please set up access.`,
    ``,
    `  Client         ${client.name}`,
    `  Type           ${onboarding.userType || 'Employee'}`,
    `  Username       ${onboarding.username || '—'}`,
    `  First Name     ${onboarding.firstName || '—'}`,
    `  Last Name      ${onboarding.lastName || '—'}`,
    `  Email          ${onboarding.email || '—'}`,
    `  Institution    ${onboarding.institution || '—'}`,
    `  Joining Date   ${onboarding.joiningDate || '—'}`,
    ``,
    `A CSV copy of the user details is attached.`,
    `--------------------------------------------`,
    `License Tracking System · Safe Spaces`,
  ].join('\n');

  const csv = toCsv(
    ['Client', 'Type', 'Username', 'First Name', 'Last Name', 'Email', 'Institution', 'Joining Date'],
    [[client.name, onboarding.userType || 'Employee', onboarding.username || '', onboarding.firstName || '',
      onboarding.lastName || '', onboarding.email || '', onboarding.institution || '', onboarding.joiningDate || '']],
  );
  const message = {
    to: ONBOARDING_TO, from: FROM, subject, text,
    attachments: [{ filename: `onboarding-${client.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, content: csv, contentType: 'text/csv' }],
    sentAt: new Date().toISOString(),
    meta: { kind: 'user-onboarding', clientName: client.name, username: onboarding.username },
  };

  await deliver(message);
  return message;
}

// Sent to tech.support when a client onboards MULTIPLE users at once.
export async function sendBulkOnboardingNotification({ client, onboardings }) {
  const subject = `[Onboarding] ${onboardings.length} new user${onboardings.length > 1 ? 's' : ''} onboarded — ${client.name}`;
  const lines = onboardings.map((o, i) => [
    `  ${i + 1}. ${[o.firstName, o.lastName].filter(Boolean).join(' ') || o.username || '—'}  (${o.userType || 'Employee'})`,
    `     Username: ${o.username || '—'}   Email: ${o.email || '—'}   Institution: ${o.institution || '—'}   Joining: ${o.joiningDate || '—'}`,
  ].join('\n'));
  const text = [
    `USER ONBOARDING — INFORMATION FOR TECH TEAM`,
    `============================================`,
    ``,
    `${client.name} has onboarded ${onboardings.length} new user(s). Please set up access.`,
    ``,
    ...lines,
    ``,
    `A CSV of all users is attached.`,
    `--------------------------------------------`,
    `License Tracking System · Safe Spaces`,
  ].join('\n');

  const csv = toCsv(
    ['Client', 'Type', 'Username', 'First Name', 'Last Name', 'Email', 'Institution', 'Joining Date'],
    onboardings.map((o) => [client.name, o.userType || 'Employee', o.username || '', o.firstName || '',
      o.lastName || '', o.email || '', o.institution || '', o.joiningDate || '']),
  );
  const message = {
    to: ONBOARDING_TO, from: FROM, subject, text,
    attachments: [{ filename: `onboarding-${client.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, content: csv, contentType: 'text/csv' }],
    sentAt: new Date().toISOString(),
    meta: { kind: 'user-onboarding-bulk', clientName: client.name, count: onboardings.length },
  };

  await deliver(message);
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
