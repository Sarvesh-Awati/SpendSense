# SpendSense — AI-Assisted Personal Finance Dashboard

SpendSense is a personal finance application for tracking transactions across multiple
currencies, setting budgets and savings goals, monitoring subscriptions, and extracting
transaction data from receipt photographs.

It is a two-workspace monorepo: a React SPA and an Express/Prisma REST API over PostgreSQL.

---

## Contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Currency model](#currency-model)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Database and migrations](#database-and-migrations)
- [Tests](#tests)
- [Deployment](#deployment)
- [Security model](#security-model)
- [Known limitations](#known-limitations)

---

## What it does

| Area | Behaviour |
|---|---|
| **Transactions** | Create, edit, delete, search, filter by category/type/date/amount, sort on an allowlisted set of columns, paginate deterministically. Each transaction stores its original amount and currency plus a conversion into the account's reporting currency. |
| **Dashboard** | Balance, monthly income/expense, savings rate, a financial-health score, month-over-month comparison, category breakdown, 30-day trend, top merchants, recent activity, and budget/goal/subscription summaries. |
| **Analytics** | Monthly trends, income vs. expense, category comparison, net-worth trend, savings trend, averages, and a set of derived "smart" statistics. AI commentary is fetched separately (see below). |
| **Budgets** | Per-category or overall limits over an explicit date range, with spend, remaining, percentage used, warning/exceeded state, and a pace-based projection. |
| **Savings goals** | Target amount and optional target date, with progress, required monthly contribution, and a pace-based completion likelihood. Contributions apply atomically. |
| **Subscriptions** | Recurring costs with weekly/monthly/yearly renewal, correct month-end and leap-year handling, monthly/annual equivalents, and a reporting-currency total that refuses to mix currencies. |
| **Receipt scanner** | Upload a receipt image; Gemini extracts merchant, amount, date, currency and a suggested category; you confirm the date, review a prefilled transaction form, and save. The stored receipt is linked to the transaction it produced. |
| **Profile** | Name, avatar, display currency, date/time format, theme, notification preferences, password change, data export, and account deletion. |

**AI is used in exactly two places:** receipt extraction and analytics commentary. Both are
Google Gemini (`gemini-2.0-flash`), both are bounded by a 25-second timeout, and both
degrade to a clearly-labelled unavailable state rather than blocking the feature they serve.

---

## Architecture

```
spendsense/
├── package.json               # npm workspaces root
├── render.yaml                # backend deployment (Render)
├── vercel.json                # frontend deployment (Vercel)
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/        # committed migration history
│   └── src/
│       ├── app.ts             # express app: helmet, CORS allowlist, routes, error handler
│       ├── server.ts          # listen, graceful shutdown, periodic token purge
│       ├── config/env.ts      # zod-validated env, with production-only hardening
│       ├── routes/            # thin routers: auth guard, validation, controller
│       ├── controllers/       # HTTP in/out only
│       ├── services/          # business rules (money, currency, dashboard, analytics, AI)
│       ├── repositories/      # Prisma access
│       ├── validators/        # zod request schemas
│       ├── middleware/        # auth, validate, rate limiters, upload, error handler
│       └── utils/             # money/Decimal helpers, JWT, tokens, serialization
└── frontend/
    └── src/
        ├── App.tsx            # routes (authenticated pages are code-split)
        ├── context/           # AuthContext
        ├── components/ui/     # Button, Field, Modal, PageHeader, EmptyState, ErrorState, Skeleton, Card, Toast
        ├── features/          # one directory per product area
        ├── services/          # axios client + React Query hooks
        └── utils/             # currency formatting
```

**Stack.** React 18 · Vite · TypeScript · TailwindCSS · React Router 6 · TanStack Query 5 ·
React Hook Form + Zod · Recharts · lucide-react — against Express 4 · Prisma 5 · PostgreSQL ·
jsonwebtoken · bcryptjs · helmet · express-rate-limit · multer · nodemailer · zod.

---

## Currency model

This is the part most worth understanding before changing anything.

Each account has two distinct currency fields:

- **`baseCurrency`** — the account's canonical *accounting* currency. Every
  `Transaction.convertedAmount` is denominated in it. It is deliberately not an ordinary
  editable setting: changing it would invalidate every historical conversion.
- **`preferredCurrency`** — a *display* preference. Changing it never alters stored
  accounting values.

Every monetary record stores four things: its original `amount`, its original `currency`,
the `exchangeRate` used, and the resulting `convertedAmount`. The rate is captured **at the
record's own date**, so a transaction dated last March is priced at last March's rate and
stays there — today's rate moving never rewrites history.

Three rules hold throughout:

1. **Aggregates only ever sum `convertedAmount`.** Summing raw `amount` across currencies
   would add ₹ to $ as though they were the same unit.
2. **Conversion fails closed.** If no trustworthy rate is available, the write is rejected
   with `503`. A rate of `1` is never substituted for differing currencies.
3. **Reporting refuses rather than understates.** Postgres `SUM()` skips NULLs, so a single
   unpriced row would silently shrink a total. Reporting endpoints check for unpriced rows
   first and return `409` instead of a plausible-looking wrong number.

Worked example — ₹10,000 income and a $100 expense at 1 USD = ₹84:

```
income  = ₹10,000
expense = ₹8,400      (100 × 84)
balance = ₹1,600      — never ₹9,900
```

Budgets and goals are always denominated in the account's reporting currency, so their
limits and their converted spend share one unit and no FX arithmetic happens in the maths.
The UI shows this as a read-only field rather than offering a choice the API would discard.

---

## Local development

**Prerequisites:** Node.js 18+, npm 9+, and a PostgreSQL database.

```bash
git clone https://github.com/Sarvesh-Awati/SpendSense.git
cd SpendSense
npm install                                   # workspaces link automatically

cp backend/.env.example backend/.env          # then fill in DATABASE_URL and secrets
npm run prisma:generate
npm run db:deploy                             # apply migrations
npm run db:seed                               # optional: default categories

npm run dev:backend                           # http://localhost:5001
npm run dev:frontend                          # http://localhost:3000
```

The frontend needs no configuration locally: it calls the relative path `/api`, which the
Vite dev server proxies to the backend on port 5001.

**Root scripts**

| Command | Does |
|---|---|
| `npm run dev:backend` / `dev:frontend` | Start either dev server |
| `npm run build` | Build both workspaces |
| `npm test` | Full backend suite (unit + HTTP integration) |
| `npm run typecheck` | `tsc --noEmit` across both workspaces |
| `npm run db:deploy` | Apply pending migrations (safe; never resets) |
| `npm run db:migrate` | Create a new migration during development |
| `npm run db:seed` | Seed default categories |

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **yes** | PostgreSQL connection string |
| `JWT_SECRET` | **yes** | Signs access tokens. ≥ 8 chars in dev; **≥ 32 in production** |
| `GEMINI_API_KEY` | **yes** | Receipt extraction and analytics commentary |
| `NODE_ENV` | no | `development` \| `production` \| `test` |
| `PORT` | no | Defaults to `5001` |
| `APP_URL` | prod | Public frontend URL, used to build password-reset links. Rejected in production if it points at localhost |
| `CORS_ORIGINS` | prod | Comma-separated allowlist of browser origins. **No wildcard.** Development falls back to the Vite dev server; production will not boot without it |
| `EXCHANGE_RATE_API_KEY` | no | Without it, foreign-currency transactions are rejected with `503` rather than stored at a guessed rate. Same-currency entry is unaffected |
| `EXCHANGE_RATE_BASE_URL` | no | Defaults to `https://api.exchangerate.host` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` / `EMAIL_FROM` | no | Password-reset email. Without them the reset endpoint still returns its generic success response, so account enumeration stays closed — the email simply is not sent |

In production the server **refuses to start** on weak or missing configuration rather than
booting with development defaults.

### Frontend (`frontend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | prod | API origin **without** a trailing `/api`. Unset locally, where `/api` is proxied. Inlined at build time — never put a secret in a `VITE_` variable |

---

## Database and migrations

Migration history lives in `backend/prisma/migrations/` and is committed.

```bash
npm run db:deploy      # production/CI: apply pending migrations
npm run db:migrate     # development: author a new migration
```

`0_init` is a baseline generated from the deployed schema and marked as already applied, so
existing databases were adopted without being rebuilt. **Never** use `prisma migrate reset`
or `db push --force-reset` against an environment holding real data.

---

## Tests

```bash
npm test
```

144 tests across ten suites. The security, multi-currency and hardening suites are **real
HTTP integration tests**: they boot the Express app on an ephemeral port and drive it over
the network against the real database, so routes, middleware, validators, services,
repositories and the error handler are all exercised. Only two things are ever stubbed —
the Gemini client (costs money, non-deterministic) and the exchange-rate provider (so rates
are fixed and provider failure modes can be forced).

Test users are created under `@spendsense.test` and deleted by id when the suite ends; the
cascade removes their financial records with them.

| Suite | Covers |
|---|---|
| `authTest`, `passwordResetTest` | Registration, login, profile, the full reset lifecycle |
| `transactionTest`, `dashboardTest`, `budgetTest`, `goalTest`, `subscriptionTest`, `receiptTest` | Domain logic and tenant isolation |
| `integration/authSecurityTest` | Session security, re-authentication, tokens at rest, error leakage |
| `integration/multiCurrencyTest` | Conversion, rate direction, rounding, caching, fail-closed behaviour |
| `integration/hardeningTest` | Rotation-replay detection, input validation, IDOR, budget boundaries, goal-contribution concurrency, renewal-date arithmetic, receipt payloads, AI decoupling, pagination determinism |

---

## Deployment

The committed configuration targets the stack the project already uses: **frontend on
Vercel, API on Render, PostgreSQL on Neon.**

- `vercel.json` — builds the frontend workspace, serves `frontend/dist`, rewrites all
  non-asset paths to `index.html` for client-side routing, and sets long-lived cache headers
  on fingerprinted assets.
- `render.yaml` — installs workspaces, runs `prisma generate` before the TypeScript build,
  applies migrations as a pre-deploy step (not during build, which also runs for previews),
  and health-checks `/health`. Every secret is `sync: false`, so values are entered in the
  Render dashboard and never committed.

`GET /health` round-trips to the database and answers `503` when it is unreachable, so a
release that cannot reach Postgres fails its rollout check instead of passing.

**Deploying elsewhere** needs only: `npm ci`, `prisma generate`, `tsc`,
`prisma migrate deploy`, `node dist/server.js`, with `CORS_ORIGINS` listing the frontend
origin and the frontend built with `VITE_API_URL` pointing at the API.

---

## Security model

- **Passwords** are bcrypt-hashed. One complexity policy is shared by registration, reset
  and change, so no path can be used to set a weaker password than another.
- **Access tokens** are 15-minute JWTs signed with `JWT_SECRET`. **Refresh tokens** are opaque
  256-bit random values stored only as SHA-256 hashes — a database disclosure yields nothing
  replayable. There is deliberately no refresh-token *secret*: nothing signs or verifies them,
  so revocation is a database operation (clear `refresh_tokens`), not a key rotation.
- **Rotation with replay detection.** Every login starts a token *family*; rotation carries
  it forward and marks the consumed token revoked. Presenting an already-rotated token means
  the family is compromised, so the entire family is revoked and everyone re-authenticates.
  Unrelated sessions on other devices are unaffected.
- **Re-authentication** is required for password change and account deletion. Email changes
  are not supported at all, rather than being supported unsafely.
- **Password changes** revoke every session *and* every pending reset link.
- **No account enumeration**: login and forgot-password return identical responses for known
  and unknown addresses, including when email delivery fails.
- **CORS is an allowlist** with no wildcard, and production will not boot without one.
- **Errors never leak internals.** Prisma messages embed filesystem paths and source
  excerpts; they are logged and answered with a generic message plus a correlation id.
- **Forms validate through zod, not the browser.** Every form sets `noValidate`, so the
  app's own styled, `aria-invalid`/`aria-describedby`-linked messages are what users and
  screen readers get — native constraint bubbles would otherwise abort submission before
  validation ran and bypass that wiring entirely.
- **Tenant isolation** is enforced on every resource, including the foreign keys —
  categories and receipts belonging to another user are rejected.

---

## Known limitations

Documented deliberately; none of these is presented in the UI as though it worked.

| Limitation | Detail |
|---|---|
| **Receipt images live in Postgres** | Stored as base64 data URLs. The list endpoint omits them so responses stay small, but object storage (S3/GCS) is the right answer at any real volume. |
| **Single-receipt scanning** | One image per scan. There is no multi-receipt state, and the UI does not pretend otherwise — there is no "apply to all" control. |
| **No goal contribution ledger** | Contributions apply as an atomic increment to the goal balance. The total is always correct and concurrent contributions cannot be lost, but there is no per-contribution history, so the UI does not ask for a contribution date. |
| **Notifications are not implemented** | The `Notification` model and repository exist; no endpoints or UI do. Nothing in the app claims otherwise. |
| **No natural-language transaction entry** | Earlier drafts of this README described it. It was never built. |
| **Analytics reads full history** | Every analytics request loads the account's whole transaction history, because cash-flow figures are all-time by contract. Fine at personal scale; needs windowing or materialisation at large volumes. |
| **`baseCurrency` cannot be re-based** | Changing it would invalidate every stored conversion, so it is fixed after the first transaction. A safe re-basing operation would have to re-price history explicitly. |
| **Access tokens survive account deletion for up to 15 minutes** | Access tokens are stateless JWTs, so deletion cannot revoke one already issued. Verified impact: the token grants **no writes and no other user's data** — every endpoint scoped to the deleted account returns 404 or an empty result. Refresh tokens *are* revoked immediately. Closing the window entirely would mean a database lookup on every authenticated request, which is not worth it for zero disclosure. |
| **Analytics is computed twice per page load** | The charts and the AI advisor are separate endpoints (so a slow model cannot block the charts), and each recomputes the same aggregates. Wall-clock is better; total database work is higher. A shared short-lived cache would fix it, but caching financial reads risks showing stale figures right after a write. |
| **Email is optional** | Without SMTP configured, password-reset emails are not sent. The endpoint still behaves identically for callers, so no information leaks. |

---

## License

MIT — see [LICENSE](LICENSE).
