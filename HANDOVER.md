# Handover — Saratoga Villa Booking Manager

Everything needed to run, deploy and maintain this app. Read the **Do this first**
section before anything else.

---

## Do this first

1. **Change all five user passwords.** Sign in as `admin` → Users page → change every
   password. The seed passwords are committed in
   `server/src/scripts/seedUsers.ts` in plain text, so anyone with the code can log
   in as admin and see every figure until they are changed. Changing them is safe —
   the seed only creates users that don't already exist, it never resets an existing
   password.
2. **Rotate the secrets** listed under *Environment variables* below, so the previous
   developer no longer holds live access.
3. **Verify a backup arrives** (see *Backups*). Atlas automated backups are **off** on
   the free tier, so the nightly email is the only backup that exists.

---

## What it is

A single place to run the villa's event-booking business, replacing a 700 KB
single-file HTML app that stored data in `localStorage`.

- **Frontend** — React 19 + Vite + Tailwind v4 + shadcn/ui, installable as a PWA
- **Backend** — Express 5 + Mongoose, deployed as one Vercel serverless function
- **Database** — MongoDB Atlas
- ~11,000 lines of TypeScript, 11 pages, 12 API route groups, 7 collections

Features: bookings with cost breakdown and overlap detection, payment collection,
expenses and monthly P&L, staff incentive calculation, a lead CRM, visitor log,
availability calendar, and Excel export.

`PRODUCT.md` describes the users and intent. `DESIGN.md` documents the visual system.

---

## Accounts and access

| Service | What's there | Who owns it |
|---|---|---|
| GitHub | `Rahulboraa/saratoga` — all source | transfer or add as collaborator |
| Vercel | Hosts frontend + `/api` + the cron | one project, root directory = repo root |
| MongoDB Atlas | Org → project `saratoga` → `Cluster0` (free M0, AWS Mumbai) | invite as Project Owner, or migrate |
| Resend | Sends the nightly backup email | account is `saratoganoida@gmail.com` |

**Vercel plan note:** the Hobby plan does not permit commercial use. Running the
business on it breaches Vercel's terms — move the project to an account on a paid
plan.

**Atlas note:** Atlas cannot move a project between organisations. Either accept an
invite to the existing project, or create a cluster under your own org and restore
from a backup dump (see *Backups*). The second option is cleaner: afterwards nobody
else holds your data.

---

## Environment variables

Set these in **Vercel → Settings → Environment Variables**, scope **Production**.
Values are shared separately — never commit them.

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | **Yes** | Atlas connection string, ending `/saratoga`. Without it the app silently falls back to `mongodb://127.0.0.1:27017/saratoga` and every screen fails. |
| `JWT_SECRET` | **Yes** | Any long random string. `server/src/env.ts` throws on boot in production if it is missing. Changing it logs every user out. |
| `RESEND_API_KEY` | For backups | From resend.com → API Keys. `Sending access` is enough. |
| `BACKUP_EMAIL_TO` | For backups | Must be `saratoganoida@gmail.com` — see *Backups*. |
| `CRON_SECRET` | Recommended | Any random string. Vercel sends it as a bearer token on cron calls; without it anyone can trigger the backup endpoint. |
| `BACKUP_EMAIL_FROM` | Optional | Defaults to `Saratoga Villa <onboarding@resend.dev>`. |

Do **not** set `NODE_ENV` (Vercel manages it) or `PORT` (irrelevant on serverless).

`LEGACY_SHEET_URL` and `DRY_RUN` are only used by one-off local import scripts.

**Environment variables only take effect on a new deployment.** After changing any of
them, redeploy — otherwise the running app keeps the old values.

To generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Deploying

The repo is an npm workspace with a root `vercel.json` that configures everything.
Import it as **one** Vercel project:

- **Root Directory** — the repo root. Not `api`, not `client`. `api/index.ts` imports
  from `../server/src/`, so a narrower root directory cannot build.
- **Framework Preset** — Other.
- **Build settings** — leave untouched; `vercel.json` supplies the install command,
  build command and output directory.

Pushing to `main` deploys to production automatically.

**Node version:** root `package.json` pins `"engines": { "node": "24.x" }`. If Vercel
does not offer that version the build fails with an invalid-Node-version error. Fix by
selecting the newest available version under Settings → General → Node.js Version, or
by relaxing the pin.

---

## Running locally

Requires Node (see the pin above) and either a local MongoDB or an Atlas URI.

```bash
npm install                      # from the repo root
echo "MONGODB_URI=..." > .env    # .env lives at the repo root, and is gitignored
npm run dev                      # client on :5173, server on :5000
```

The client proxies `/api` to `localhost:5000` in dev. `.env` is read by
`process.loadEnvFile()` in `server/src/env.ts` — there is no `dotenv` dependency.

| Command | What it does |
|---|---|
| `npm run dev` | Client and server together |
| `npm run build` | Builds both workspaces |
| `npm test` | Server test suite (28 tests) |
| `npm run seed` | Seeds the five users |
| `npm run seed:demo` | Demo data — refuses to run against a remote/production DB |

---

## Users and roles

Five accounts are created automatically on first boot if missing:
`admin`, `akhil` (manager), `simran` and `deepak` (sales), `caretaker`.

- **admin** — everything, including expenses, incentives, P&L and user management
- **manager** — bookings, leads, visitors, imports; no money figures
- **sales** — bookings, leads, visitors; the API strips amounts before sending
- **caretaker** — a separate minimal screen at `/caretaker` for visitors and the day's
  bookings

Money is hidden server-side for the `sales` role (`server/src/routes/bookings.ts`), not
just in the UI, so it cannot be revealed from the browser.

---

## Properties (multi-property)

Every booking, payment, expense, visitor and lead belongs to exactly one property.

- **admin** — spans all properties. The switcher in the top bar picks one, or
  *All properties* for a combined read-only view. Adding records while on
  *All properties* is refused: pick a property first. Incentives always need one
  property selected, because the slabs run per property.
- **manager / sales / caretaker** — pinned to a single property (set on the Users
  page). They never see another property's data and cannot widen it: the property
  comes from their token, and the `x-property` header is ignored for them
  (`server/src/middleware/scope.ts`).

Admin → **Properties** page creates and deactivates properties. A property with users
still assigned cannot be deleted; reassign them first.

**Migration — run once after deploying this change:**

```bash
npm run migrate:properties
```

It creates the *Saratoga Villa* property, stamps every existing record with it, and
assigns every non-admin user to it. Safe to re-run: it only touches rows that have no
property yet. Until it runs, non-admin users get a 403 because they have no property.

---

## Backups

A Vercel cron calls `GET /api/cron/backup` once daily at 20:30 UTC (about 2 AM IST) and
emails two attachments to `BACKUP_EMAIL_TO`:

- **`.xlsx`** — readable spreadsheet of bookings, payments, expenses, visitors, leads
- **`.json`** — complete raw dump, used for restores

On the Hobby plan crons run once a day at an approximate time, not an exact minute.

**Recipient constraint:** no domain is verified in Resend, so the shared
`onboarding@resend.dev` sender can only deliver to the Resend account's own address.
That address is `saratoganoida@gmail.com`, so `BACKUP_EMAIL_TO` must be exactly that.
Sending anywhere else returns a 403. To use a different recipient, verify a domain in
Resend first.

Test it manually after deploying:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-url>/api/cron/backup
```

`{"ok":true,"sentAt":"..."}` means the email went out. Check Vercel → Cron Jobs for the
scheduled run's result.

**Atlas automated backups are disabled** on the free tier. The nightly email is the
only backup. Take a manual dump before anything risky:

```bash
mongodump  --uri="$MONGODB_URI" --out ./backup-$(date +%F)
mongorestore --uri="$MONGODB_URI" ./backup-2026-08-03/saratoga --db saratoga
```

---

## Maintenance notes

**Atlas network access** must include `0.0.0.0/0`. Vercel's serverless IPs are not
fixed, so restricting to specific addresses breaks the app. Atlas → Database & Network
Access → Network Access.

**Your own IP** may also be listed there for local access. Home connections get new
addresses periodically; when you can't connect locally, use *Add Current IP Address*.
Nothing is broken.

**Tokens last 30 days** and are reissued on every authenticated request via an
`x-refresh-token` response header. A consequence: if two deployments ever run with
different `JWT_SECRET` values, users get logged out at random. Keep it identical
everywhere, and redeploy after changing it.

**The PWA does not cache navigations** (`navigateFallback` is disabled in
`client/vite.config.ts`). This is deliberate: with it enabled, installed clients kept
booting a cached `index.html` and never picked up new deploys, and non-technical users
cannot be asked to clear their cache. The trade-off is that the app will not open
offline. If offline support is needed, re-enable `navigateFallback` and add
reload-on-new-service-worker handling via `virtual:pwa-register` — do both together, or
stale clients return.

**One-time client reset:** `RESET_KEY` in `client/src/main.tsx` makes every browser
clear its cache storage and stored token once. Change the string to trigger it again
after a change that would otherwise leave clients stale.

**`.env.example` contains a live Google Apps Script URL** for the legacy import. If the
repository is public, that endpoint is readable by anyone. Rotate or restrict it.

---

## Repository layout

```
client/          React app (Vite)
  src/pages/       11 screens
  src/components/  AppLayout, DataTable, charts, forms
  src/lib/         api client, auth context, formatting
server/          Express API
  src/routes/      12 route groups
  src/models/      Booking, Payment, Expense, ExpensePayment, Lead, User, Visitor
  src/services/    backup (xlsx + json)
  src/middleware/  auth (JWT), roles
  src/scripts/     seeding, legacy import
api/index.ts     Vercel entry point; wraps the Express app
vercel.json      Build, function, cron and rewrite config
```
