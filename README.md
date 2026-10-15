# Eat n RepEat Café

Online ordering and café management system for Eat n RepEat Café (Cordova, Cebu):
customer ordering portal, staff POS + order management, and admin/owner portal —
backed by an Express + MySQL API, with offline and LAN operation support.

## Repository map

| Path | What it is |
|---|---|
| `eat-n-repeat-frontend/` | Next.js 16 customer / staff / admin web app (port `3000`). See its [README](./eat-n-repeat-frontend/README.md). |
| `eat-n-repeat-backend/` | Express + Prisma + MySQL API with JWT auth (port `4000`). See its [README](./eat-n-repeat-backend/README.md). |
| `eat-n-repeat-local/` | Electron desktop launcher that runs the whole system on the café laptop (LAN mode). See its [README](./eat-n-repeat-local/README.md). |
| `render.yaml` | Render blueprint for the hosted backend (builds, migrates, and starts the API). |
| `start-lan.bat` / `start-lan.ps1` | One-click LAN launchers for the café network. |
| `package.json` (root) | Convenience scripts that build/start the backend. |

## Portals & routes (frontend)

| Portal | Route | Highlights |
|---|---|---|
| Customer | `/customer` | Menu, cart, checkout (Cash / Cash on Delivery / GCash via Xendit), order tracking, order chat with staff, favorites, reviews, email-code verification |
| Staff | `/staff` | POS cashier, active orders + status workflow, delivery queue, cash shifts with reconciliation, chat with customers |
| Admin / Owner | `/admin` | Dashboard, menu, add-ons, delivery, cash management + shift audit, reports, stock, staff accounts, reviews, settings, archives |
| Auth | `/login`, `/customer/login`, `/customer/register` | Staff/admin sign in with JWT sessions; customers with email + verification code |

Backend health check: `GET http://localhost:4000/api/health`.

## Quick start — café LAN (recommended for service)

1. Install **Node.js 20+** and start **MySQL** via XAMPP Control Panel
   (port `3306`, `root` with empty password, matching `eat-n-repeat-backend/.env`).
2. Open `eat-n-repeat-local/`, run `npm install`, then `npm start`.
3. Click **START** and wait for the status pills to turn green.
4. Use the **STAFF** / **ADMIN** buttons, or share the **QR** code so customers
   on the café Wi-Fi can order from their phones.

First run bootstraps automatically (dependencies, `prisma generate`,
`prisma db push`, seed) and writes an `.initialized` stamp file — delete it
to force a full re-bootstrap. See [`eat-n-repeat-local/README.md`](./eat-n-repeat-local/README.md)
for troubleshooting (ports, MySQL, IP changes).

## Quick start — manual development

Backend (`http://localhost:4000`):

```bash
cd eat-n-repeat-backend
npm install
Copy-Item .env.example .env   # then set DATABASE_URL + JWT_SECRET
npm run dev
```

Frontend (`http://localhost:3000`):

```bash
cd eat-n-repeat-frontend
npm install
npm run dev
```

Useful backend scripts: `npm run db:push`, `npm run db:seed`, `npm run db:studio`,
`npm run build`, `npm start`.

## Deploying online

- **Backend (Render):** New → Blueprint → select this repo. Render reads
  `render.yaml`, which installs, generates the Prisma client, builds, and runs
  `prisma db push` on every deploy. Provide `DATABASE_URL` (externally hosted
  MySQL — Render has no managed MySQL), `JWT_SECRET`, `XENDIT_*`,
  and email (`RESEND_*` or Gmail/SMTP) secrets when prompted.
- **Frontend (Vercel):** import the repo and set **`NEXT_PUBLIC_API_URL`**
  to the Render backend URL — without it, API calls fall back to the
  frontend origin and will fail.

## Key behaviors

- **Roles & auth:** `admin`, `head_staff`, `staff`, `delivery_rider`, and
  `customer`. Staff/admin APIs require role-scoped JWTs; customers sign in
  with email + 6-digit verification code.
- **Payments:** cash at counter, Cash on Delivery (rider-collected), and GCash
  via Xendit invoices + webhooks. Cash drawer totals never include GCash.
- **Cash shifts:** open float (admin-configured), expected vs. counted cash
  reconciliation with variance, and admin verify/flag sign-off.
- **Offline support:** orders, payments, status changes, and shift ops queue
  in IndexedDB when disconnected and replay idempotently via
  `POST /api/sync/offline`; LAN mode keeps the café fully operational
  without internet.
- **Realtime:** order chat over server-sent events; staff/customer notifications.

## Contributing

Branch off `main`, keep changes scoped, and verify before opening a PR:

```bash
# frontend
cd eat-n-repeat-frontend && npx tsc --noEmit && npm run build
# backend
cd ../eat-n-repeat-backend && npx tsc --noEmit && npm run build
```
