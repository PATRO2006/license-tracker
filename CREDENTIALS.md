# Login Credentials

Default credentials seeded into the system. Each client sees **only their own**
dashboard; the admin sees everyone and can edit, review, and approve.

> These are temporary defaults — users can be given the ability to change their
> username/password later. Change them before real production use.

## Admin

| Role  | Login (email)                | Password     | Notes        |
| ----- | ---------------------------- | ------------ | ------------ |
| Admin | `support@safespacesinc.in`   | `Admin@2026` | Full access  |

> The admin signs in with the **email address** (no username). Notifications are
> also sent to this address.

## Clients (each sees only their own data)

| Company    | Username      | Password         |
| ---------- | ------------- | ---------------- |
| Fittr      | `fittr`       | `Fittr@2026`      |
| GSP Crop   | `gsp-crop`    | `GSPCrop@2026`    |
| Machaxi    | `machaxi`     | `Machaxi@2026`    |
| Biopeak    | `biopeak`     | `Biopeak@2026`    |
| Alter      | `alter`       | `Alter@2026`      |
| Tech Japan | `tech-japan`  | `TechJapan@2026`  |
| Quantana   | `quantana`    | `Quantana@2026`   |
| Invarsys   | `invarsys`    | `Invarsys@2026`   |
| Sunfan     | `sunfan`      | `Sunfan@2026`     |
| Technip    | `technip`     | `Technip@2026`    |
| Emergence  | `emergence`   | `Emergence@2026`  |
| Endor Labs | `endor-labs`  | `EndorLabs@2026`  |

## Adding more clients later

The admin can add a new client from the **Clients → Add client** screen. The
system creates the client record **and** its login automatically (username = the
company slug, password = `CompanyName@2026`) and shows the credentials to share.
No code changes or redeploys are needed — this scales to any number of clients.
