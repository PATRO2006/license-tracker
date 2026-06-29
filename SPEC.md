# License Tracking System — Technical Specification

**Version:** 1.0 · **Status:** Reference implementation · **Date:** June 2026

This specification documents the License Tracking System: its data model, business
rules, screens, API, and workflows. It is implemented by the accompanying `server/`
(Express API) and `client/` (React UI) codebase and maps directly to the six core
features in the requirement overview.

---

## 1. Objective & scope

Manage and monitor client licenses across their full lifecycle, with complete
visibility into allocations, utilization, renewals, expiry dates, and client requests.
The system provides a dashboard, per-client detail views, a license-request workflow,
an audit trail, and automated email notifications.

| Requirement area | Where it lives |
| --- | --- |
| 1. Client license management | `Client` model, `/api/clients`, Clients + Detail screens |
| 2. License history tracking | `HistoryRecord` model, audit trail on Detail screen |
| 3. License health & status | `logic.js → computeStatus`, status chips |
| 4. Dashboard & reporting | `logic.js → buildDashboard`, Dashboard screen |
| 5. License request management | `Request` model, `/api/requests`, Requests screen |
| 6. Email notifications | `email.js`, Notifications screen |

---

## 2. Data model

### 2.1 Client

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Slug / unique key |
| `name` | string | Client name |
| `accountOwner` | string | Internal owner |
| `contractStart` | date (YYYY-MM-DD) | Contract start date |
| `contractEnd` | date | Contract end date |
| `renewalDate` | date | License recharge / renewal date |
| `totalPurchased` | int | **Total Licenses Purchased** (a.k.a. *Ordered*) |
| `activeLicenses` | int | **Active Licenses** in use (a.k.a. *Used*) |
| `licenseThreshold` | int | Available-license floor that triggers *Warning* |
| `notes` | string | Free-text advisory |

**Derived (computed, never stored):**

- `availableLicenses` = `totalPurchased − activeLicenses` (may be negative when over-utilized)
- `utilization` = `activeLicenses / totalPurchased` (as a %)
- `daysToExpiry` = `contractEnd − today`
- `status` — see §3
- `pendingRequests` — count of this client's requests in `Pending`

### 2.2 Request (license request)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Unique key |
| `clientId` | string | FK → Client |
| `type` | enum | `new` · `additional` · `renewal` |
| `requestedCount` | int | Licenses requested |
| `currentCount` | int | Snapshot of `totalPurchased` at request time |
| `details` | string | Reason / context |
| `status` | enum | `Pending` · `Approved` · `Rejected` · `Completed` |
| `requestDate` | date | Created on |
| `completionDate` | date \| null | Set on approve/complete |

### 2.3 HistoryRecord (audit trail)

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Unique key |
| `clientId` | string | FK → Client |
| `date` | date | When the change occurred |
| `action` | enum | `allocation` · `purchase` · `renewal` · `modification` · `extension` |
| `detail` | string | Human-readable description |
| `changedBy` | string | Actor (the "by whom" of the audit trail) |
| `licenseDelta` | int | Net license change (+/−/0) |

---

## 3. License health & status rules

Status is computed in `logic.js → computeStatus`. The requirement overview defines
five statuses (*Healthy, Warning, Expiring Soon, Expired, Pending Request*). The
Stitch mock-ups add two over-capacity gradations (*At Capacity, Over-utilized*) which
this system treats as more severe variants of *Warning*. All seven are supported.

**Precedence (most urgent first):**

```
Expired → Over-utilized → At Capacity → Expiring Soon → Warning → Healthy
```

| Status | Condition |
| --- | --- |
| **Expired** | `daysToExpiry < 0` (contract end date has passed) |
| **Over-utilized** | `utilization > 100%` — usage exceeds licenses ordered |
| **At Capacity** | `utilization ≥ 95%` (and ≤ 100%) |
| **Expiring Soon** | `0 ≤ daysToExpiry ≤ 30` |
| **Warning** | `available < licenseThreshold` |
| **Healthy** | none of the above; sufficient licenses, contract active |
| **Pending Request** | *orthogonal flag* — true whenever the client has any `Pending` request |

`EXPIRING_SOON_DAYS` (default **30**) is configurable in `logic.js`. *Pending Request*
is surfaced as a separate badge/flag (`hasPendingRequest`, `pendingRequests` count) so
it can coexist with any health status.

---

## 4. Dashboard & reporting

`GET /api/dashboard` (`logic.js → buildDashboard`) returns the roll-up:

| Metric | Definition |
| --- | --- |
| `totalClients` | Count of clients |
| `totalLicenses` | Σ `totalPurchased` |
| `activeLicenses` | Σ `activeLicenses` |
| `availableLicenses` | Σ `max(0, available)` |
| `pendingRequests` | Count of `Pending` requests |
| `expiringSoon` | Clients with status *Expiring Soon* |
| `expired` | Clients with status *Expired* |
| `overCapacity` | Clients *At Capacity* or *Over-utilized* |
| `healthSummary` | Map of status → client count |
| `clients` | Full enriched client list |

---

## 5. License request management

### 5.1 Lifecycle

```
                ┌──────────► Rejected (terminal)
   (create)     │
  ───────────► Pending ──► Approved ──► Completed (terminal)
                │                          ▲
                └──────────────────────────┘  (Pending → Completed allowed)
```

- **Create** (`POST /api/requests`) — always starts as `Pending`, snapshots the
  client's current license count, and **fires an email notification** (§6).
- **Approve / Reject** (`PATCH /api/requests/:id`) — sets status; approve/complete
  stamp `completionDate`.
- **Complete** — for `additional`/`new` requests, adds `requestedCount` to the
  client's `totalPurchased` **and** writes a `purchase` audit-trail record. For
  `renewal` requests, writes a `renewal` audit record (no seat change).

### 5.2 Request history

Every client retains its full request history (all statuses), shown on the Detail
screen and queryable via `GET /api/requests?status=…`.

---

## 6. Email notification system

Implemented in `email.js`. An email is sent **to Anusha** whenever a request is
raised — covering all three triggers in the requirements: a client requests *new*
licenses, *additional* licenses, or a *renewal/recharge*.

**Email contents (all required fields):**

- Client Name
- Request Date
- Requested License Count
- Current License Count
- Request Details
- Request Status

**Delivery:** uses SMTP via nodemailer when `SMTP_HOST` (and related) env vars are
set; otherwise writes to `server/data/outbox.json` and logs to console, so the
end-to-end flow is demonstrable without credentials. Recipient defaults to
`NOTIFY_EMAIL` (Anusha) and is configurable.

---

## 7. API reference

Base URL: `http://localhost:4000`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/dashboard` | Dashboard roll-up + enriched clients |
| GET | `/api/clients` | All clients (enriched with status/derived fields) |
| GET | `/api/clients/:id` | One client + request history + audit trail |
| POST | `/api/clients` | Create client (writes initial-allocation audit record) |
| GET | `/api/clients/:id/history` | Audit trail for a client |
| GET | `/api/requests[?status=]` | List requests, optional status filter |
| POST | `/api/requests` | Create request → **sends email** |
| PATCH | `/api/requests/:id` | Update status (approve/reject/complete) |
| GET | `/api/outbox` | Generated email notifications |
| GET | `/api/health` | Liveness check |

**Example — raise a request:**

```http
POST /api/requests
{ "clientId": "gsp-crop", "type": "additional", "requestedCount": 15,
  "details": "Team expanding to a second region." }

→ 201 { "request": { …, "status": "Pending" }, "emailQueued": true }
```

---

## 8. Screens (UI)

| Screen | Route | Contents |
| --- | --- | --- |
| **Dashboard** | `/` | KPI cards (totals, expiring, expired, pending), health summary, client cards with capacity bars and status chips. Over-utilized/expired cards get a red accent. |
| **Clients** | `/clients` | Searchable table: status, utilization, used/ordered/available, renewal, pending count. "New request" action. |
| **Client detail** | `/clients/:id` | Alert banner, semicircular **capacity gauge**, license summary tiles, contract details, request history, and a timeline **audit trail**. Upsell callout when at/over capacity. |
| **Requests** | `/requests` | All requests with status filters and approve / reject / complete actions. |
| **Notifications** | `/notifications` | Rendered email outbox sent to Anusha. |

**Design system** (`styles.css`), from the mock-ups: primary `#3730A3`, secondary
`#6366F1`, tertiary `#752CD0`, neutral `#78767F`; status palette green/amber/red/
indigo; Inter type; rounded cards with soft shadows.

---

## 9. Worked example (matches the requirement's sample workflow)

1. Client contract created with 100 licenses → `allocation` audit record.
2. Contract start/end stored on the Client.
3. Client uses 90 → `activeLicenses = 90`, `available = 10`.
4. With `licenseThreshold = 15`, `available (10) < threshold` → **Warning**.
5. Client requests 50 more → `POST /api/requests` (`additional`, 50) → **Pending**.
6. Request stored as Pending.
7. Email automatically sent to Anusha with all six fields.
8. Approve → Complete → `totalPurchased += 50` (now 150) and a `purchase` audit
   record is written.
9. Dashboard and client status refresh automatically.

---

## 10. Assumptions & extension points

- **Auth/identity** is out of scope; `changedBy`/actor is passed in for the audit
  trail and would come from the authenticated user in production.
- **Persistence** uses a JSON file for zero-setup; swap `db.js` for Postgres/Prisma
  without touching `logic.js` or routes.
- **Scheduled checks** (e.g. a daily job emailing expiring/expired contracts) are a
  natural addition on top of `buildDashboard`.
- **Thresholds** (`licenseThreshold` per client, `EXPIRING_SOON_DAYS` global) are
  configurable.
