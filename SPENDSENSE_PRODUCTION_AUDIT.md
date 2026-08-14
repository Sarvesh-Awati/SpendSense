# SpendSense Production Audit

**Engineering Audit · Read-only · No source files modified**

A full-repository review of the SpendSense monorepo covering correctness, security, database design, financial logic, API contracts, frontend quality, performance, testing and deployment readiness. Five of the most severe findings were reproduced against the running application rather than inferred from reading code.

| | |
|---|---|
| **Repo** | SpendSense (npm workspaces) |
| **Branch** | `main` |
| **HEAD** | `e19794b` |
| **Date** | 2026-08-13 |
| **Scope** | 122 source files · ~14k LOC |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Verdict](#verdict)
3. [Findings by Severity](#findings-by-severity)
4. [Top 10 Things to Fix First](#top-10-things-to-fix-first)
5. [Critical Issues](#critical-issues)
6. [High Priority Issues](#high-priority-issues)
7. [Medium Priority Issues](#medium-priority-issues)
8. [Low Priority Issues](#low-priority-issues)
9. [Informational](#informational)
10. [Security Findings](#security-findings)
11. [Database Findings](#database-findings)
12. [Financial Logic Findings](#financial-logic-findings)
13. [Frontend and UI Findings](#frontend-and-ui-findings)
14. [API Contract Findings](#api-contract-findings)
15. [Performance Findings](#performance-findings)
16. [Code Quality Findings](#code-quality-findings)
17. [Testing Gaps](#testing-gaps)
18. [Deployment Findings](#deployment-findings)
19. [Documentation Mismatches](#documentation-mismatches)
20. [Project Readiness Score](#project-readiness-score)

---

## Executive Summary

SpendSense is a well-organised codebase. The layering (routes → validators → controllers → services → repositories) is real and mostly followed, tenant scoping is applied consistently on the resources that matter, Zod validation is present on almost every mutating endpoint, both workspaces typecheck cleanly under `strict: true`, and the domain logic in the dashboard and budget services is more thoughtful than most projects at this stage. That is the good news, and it is genuinely good.

It is not, however, close to production-ready — and the gap is not a matter of polish. The authentication system has a hole that lets any holder of a 15-minute access token permanently take over an account, the login endpoint fails outright under trivially common conditions, session persistence is broken by a stale URL prefix left behind by the most recent commit, and the password-reset feature shipped in the working tree currently returns HTTP 500 for every real user while returning 200 for every fake one — a textbook account-enumeration oracle that also means the feature does not work at all.

### Verdict

> **Do not deploy.** Three of the five CRITICAL findings are live-verified and independently sufficient to block release. The most severe (`C1`) is an account-takeover primitive, not a theoretical weakness. Budget roughly one to two weeks of focused remediation before a security re-review is worthwhile.

### The four themes that recur throughout this report

1. **Two code paths for the same operation, with different security.** Password change exists twice — once done correctly (`changePassword`, requires the current password) and once done dangerously (`updateProfile`, requires nothing). The correct path is what the UI calls; the dangerous one is what an attacker calls.

2. **Money is handled as JavaScript floats.** Prisma `Decimal` columns are correct at rest, but every read converts through `Number()`, and at least one write path (goal contributions) is a non-atomic read-modify-write that silently loses concurrent updates.

3. **The multi-currency schema is decorative.** Ten currencies, plus `baseCurrency`, `exchangeRate` and `convertedAmount` columns on four models — none of it is written or read. Meanwhile `currency` is silently dropped on transaction create, and all aggregates sum mixed currencies as if they were one unit.

4. **The tests cannot fail.** Every suite mocks the repository layer, so they exercise arithmetic in isolation and never touch HTTP, authorization, the database, or any of the bugs in this report. All 30 assertions pass against an application with five critical defects.

---

## Findings by Severity

| Severity | Count |
|---|---|
| **CRITICAL** | 5 |
| **HIGH** | 12 |
| **MEDIUM** | 21 |
| **LOW** | 14 |
| **INFO** | 6 |
| **Total** | **58** |

Findings marked **[VERIFIED LIVE]** were reproduced against the running application on this machine, with the observed response recorded in the finding.

---

## Top 10 Things to Fix First

Ordered by actual impact — likelihood of exploitation or user-visible breakage first, architectural debt last.

| # | Action | Rationale | Refs |
|---|---|---|---|
| 01 | **Remove the `password` and `email` fields from `updateProfile`** | The single highest-impact change in this report. Converts a stolen access token from a 15-minute nuisance into permanent account takeover. | `C1` |
| 02 | **Stop storing the raw JWT as the refresh-token primary key** | Fixes the 409 login failure and the plaintext-token-at-rest problem in one change: store a random opaque token, persist only its SHA-256 hash. | `C2` `C4` |
| 03 | **Fix the doubled `/api` prefix in `AuthContext`** | Two lines. Restores session persistence across page reloads and makes logout actually revoke the server-side session. | `C3` |
| 04 | **Make `forgotPassword` swallow email-delivery failure** | Closes the enumeration oracle and unbreaks password reset. Log the failure server-side; always return 200. | `C5` |
| 05 | **Require the current password for account deletion, and revoke sessions on password change** | Two small additions that close the remaining takeover and destruction paths. | `H1` `H2` |
| 06 | **Map Prisma and Multer errors in the global error handler** | Currently any bad UUID returns 500 with your absolute filesystem path and a source-code excerpt in the response body. | `H3` `H4` |
| 07 | **Make goal contributions atomic** | Replace read-modify-write with a Prisma `increment`. This is silent financial data loss under concurrency. | `H5` |
| 08 | **Invalidate `dashboard`, `budgets` and `analytics` after transaction mutations** | The most visible everyday bug: add an expense, and the dashboard shows the old balance for five minutes. | `H6` |
| 09 | **Decide on currency — implement it or remove it** | Right now the UI offers a choice that is silently discarded, and totals add USD to INR. Either is defensible; the current middle ground is not. | `H7` `H8` |
| 10 | **Replace the mocked unit tests with integration tests over HTTP** | Until a test can fail, none of the above stays fixed. Start with auth, tenant isolation, and the money paths. | `H12` |

---

## Critical Issues

> Security vulnerabilities, broken authentication, or defects that make the application unusable.

---

### C1 — Password and email can be changed with no re-authentication

**Severity:** CRITICAL · **[VERIFIED LIVE]**

**File / Function:** `backend/src/controllers/userController.ts:43–45` · `updateProfile` · route `PUT /api/users/profile`
**Related:** schema at `backend/src/validators/user.ts:8`

**Problem**
`updateProfileSchema` accepts an optional `password` field, and the controller writes it straight to `passwordHash` with no `currentPassword` check, no complexity validation (`min(8)` only), and no session revocation. It also accepts `email` with no verification step and no password confirmation. A correct implementation already exists twelve lines below in `changePassword`, which does require the current password.

**Root cause**
The `/api/users` surface bypasses the service layer entirely (see `M19`). The security invariants that live in `authService` were never applied here, because this controller talks to `prisma` directly.

**Why it matters**
This converts any short-lived access-token compromise into permanent, total account takeover. Because tokens live in `localStorage`, a single XSS is sufficient. The email path is worse: change the address, then use the normal forgot-password flow to receive the reset link at an attacker-controlled inbox — no password ever needed.

**Evidence / reproduction**
Reproduced on the running server. A registered account's password was changed to `hijacked1` — a value that would be rejected outright by the registration validator's complexity rules — using only a bearer token:

```
PUT /api/users/profile   {"password":"hijacked1"}      -> 200
POST /api/auth/login     {"password":"hijacked1"}      -> 200 success
GET  /api/auth/me        (token issued BEFORE change)  -> 200 still valid
```

**Recommended fix**
Delete `password` from `updateProfileSchema` and the `if (password)` branch in the controller — `changePassword` is the only password path. Move `email` behind a dedicated endpoint that requires the current password and a confirmation email to the new address. Have both revoke all refresh tokens on success.

---

### C2 — Two logins in the same second collide and fail with HTTP 409

**Severity:** CRITICAL · **[VERIFIED LIVE]**

**File / Function:** `backend/src/utils/jwt.ts:27–33` · `generateRefreshToken`
**Related:** `backend/prisma/schema.prisma:85` — `token String @unique`

**Problem**
The refresh token is a JWT whose only claims are `sub`, `email`, `iat` and `exp`. `iat` has one-second resolution, so two tokens minted for the same user within the same second are byte-for-byte identical. The `refresh_tokens.token` column is `@unique`, so the second insert violates the constraint, and the global error handler maps `P2002` to a 409.

**Root cause**
A JWT was chosen for a credential that is looked up in the database anyway. The signature buys nothing here, and the payload contains no unique nonce.

**Why it matters**
Login is not idempotent and fails under entirely ordinary conditions: signing in on two devices, a double-clicked submit button, two browser tabs restoring a session, or any concurrent token refresh. The user sees "A record with this field already exists" on a login form — an error message that reveals a database constraint and suggests nothing actionable.

**Evidence / reproduction**
Three concurrent logins for the same account, all three rejected; token identity confirmed directly:

```
3x POST /api/auth/login (same second)
  -> error  A record with this field already exists
  -> error  A record with this field already exists
  -> error  A record with this field already exists

generateRefreshToken(p) === generateRefreshToken(p)  ->  true
```

**Recommended fix**
Refresh tokens should not be JWTs at all — they are looked up in the database anyway, so the signature buys nothing. Issue `crypto.randomBytes(32).toString('hex')`, store only its SHA-256 hash, and compare by hash. This resolves `C2` and `C4` together. If the JWT form is kept for other reasons, add a `jti` claim.

---

### C3 — Doubled `/api` prefix breaks session restore and server-side logout

**Severity:** CRITICAL · **[VERIFIED LIVE]**

**File / Function:** `frontend/src/context/AuthContext.tsx:54` and `:93` · `logout`, `initializeAuth`
**Related:** `baseURL: '/api'` in `frontend/src/services/api.ts:5`

**Problem**
Commit `e19794b` moved the `/api` prefix into the Axios `baseURL` and stripped it from every call site — except these two. They still pass `/api/auth/me` and `/api/auth/logout`, which resolve to `/api/api/auth/…` and 404.

**Root cause**
An incomplete refactor. `AuthContext.tsx` is not in the modified-file set of commit `e19794b`, while `services/api.ts` and all seven service modules are.

**Why it matters**
Two separate failures. First, `initializeAuth` treats any error from `/me` as an expired session and calls `logout()` — so every page reload logs the user out despite valid tokens sitting in `localStorage`. Second, `logout` catches the 404 silently, so the refresh token is never revoked server-side; "Log out" is purely cosmetic and the 30-day token remains valid forever.

**Evidence / reproduction**
Both paths confirmed against the dev server:

```
GET  /api/api/auth/me       -> 404      POST /api/api/auth/logout -> 404
GET  /api/auth/me           -> 401  (correct path, reaches the API)
```

Repository-wide search for remaining stale prefixes returned exactly these two call sites.

**Recommended fix**
Change both to `/auth/me` and `/auth/logout`. Separately, `initializeAuth` should only force logout on a 401 — a network error or 5xx should leave the cached session intact rather than ejecting the user.

---

### C4 — Refresh tokens are stored in plaintext

**Severity:** CRITICAL

**File / Function:** `backend/prisma/schema.prisma:83–97` · `RefreshToken.token`
**Related:** written by `backend/src/services/authService.ts:276`

**Problem**
The full, usable refresh token is stored verbatim in the database. The project already knows better — `PasswordResetToken` stores only `tokenHash`, and `authService.forgotPassword` hashes with SHA-256 before persisting. The same reasoning was not applied to the longer-lived credential.

**Root cause**
The refresh-token table predates the password-reset table. The better pattern was introduced later and never applied retroactively.

**Why it matters**
Any read access to the database — a backup, a log dump, a SQL injection elsewhere, a compromised analytics replica, a misconfigured Neon branch — yields directly usable 30-day sessions for every user. Password hashes are protected by bcrypt; the refresh tokens sitting beside them are not protected at all.

**Evidence / scenario**
An operator with read-only DB access, or anyone who obtains a nightly backup, can authenticate as any user for 30 days without touching a password. Nothing in the application would record or detect this.

**Recommended fix**
Store `tokenHash` and look up by hash, mirroring `PasswordResetTokenRepository`. Add a `revokedAt` column and a token-family identifier so that reuse of an already-rotated token can revoke the whole family — currently rotation detects nothing (see `H9`).

---

### C5 — Password reset leaks account existence and is non-functional

**Severity:** CRITICAL · **[VERIFIED LIVE]**

**File / Function:** `backend/src/services/authService.ts:170–195` · `forgotPassword`
**Related:** `backend/src/services/EmailService.ts:52–57`

**Problem**
`forgotPassword` returns early and silently for unknown emails — correct. For known emails it proceeds to `emailService.sendPasswordResetEmail`, which throws `InternalServerError` when SMTP is unconfigured. That exception propagates, so the endpoint returns 500 for real accounts and 200 for fake ones. The controller's anti-enumeration comment is defeated by the line it is written above.

**Root cause**
`EmailService` treats missing configuration as an exceptional condition and throws. `forgotPassword` awaits it without a try/catch, so a delivery-layer failure becomes an HTTP status difference that is correlated with account existence.

**Why it matters**
This is a perfect enumeration oracle: an attacker can test an arbitrary email list against your user base by reading status codes, and the 500 body even explains the cause. It is also a total feature outage — no SMTP variables are set in `backend/.env`, so password reset does not work for any user today. The same 500 occurs in production whenever the SMTP provider has a transient failure.

**Evidence / reproduction**
Two requests, same endpoint, different outcome purely by account existence:

```
POST /api/auth/forgot-password  {"email":"definitely-not-a-user-9931@example.com"}
  -> 200

POST /api/auth/forgot-password  {"email":"<a real registered address>"}
  -> 500  {"message":"Email provider is not configured. Please set SMTP_HOST, ..."}
```

**Recommended fix**
Wrap the send in try/catch inside `forgotPassword`; log the failure with context server-side and always return the same 200. Better still, enqueue the send so the HTTP response never depends on SMTP latency. Add a startup check that logs loudly when SMTP is unconfigured, rather than failing per-request.

---

## High Priority Issues

> Broken features, serious authorization gaps, incorrect financial results, and significant production risks.

---

### H1 — Account deletion requires no re-authentication

**Severity:** HIGH

**File / Function:** `backend/src/controllers/userController.ts:113–125` · `deleteAccount` · route `DELETE /api/users/account`

**Problem**
The endpoint takes a bearer token and immediately runs `prisma.user.delete`, which cascades to every transaction, budget, goal, subscription, receipt and notification. There is no password confirmation, no grace period, no soft delete, no export prompt. The only guard is a client-side `window.confirm` in `Profile.tsx:144`, which an attacker calling the API never sees.

**Root cause**
Destructive-action confirmation was implemented in the UI rather than at the API boundary.

**Why it matters**
Irreversible destruction of all financial history from a single stolen access token, with no recovery path and no audit record that it happened.

**Scenario**
XSS or a borrowed unlocked laptop; one request wipes years of records. The user's only remaining copy is whatever they had previously exported by hand.

**Recommended fix**
Require `currentPassword` in the body and verify it. Soft-delete with a `deletedAt` column and a 30-day purge job, and email a confirmation on request.

---

### H2 — Password change does not revoke existing sessions

**Severity:** HIGH

**File / Function:** `backend/src/controllers/userController.ts:78–98` · `changePassword`

**Problem**
The hash is updated and nothing else. Every previously issued refresh token stays valid for its full 30 days. Notably, `authService.resetPassword` gets this right at line 237 — `deleteManyByUserId` — so the codebase contains both the correct and incorrect behaviour for the same operation.

**Root cause**
Same as `C1` and `H1`: this controller sits outside the service layer where the correct pattern lives.

**Why it matters**
Changing your password is the canonical response to suspecting compromise. Here it does not evict the attacker, which makes the security advice the UI implies actively wrong.

**Scenario**
User notices unfamiliar activity, changes their password, sees a success toast. The attacker's session continues uninterrupted for up to 30 days.

**Recommended fix**
Call `refreshTokenRepository.deleteManyByUserId(userId)` after a successful change, matching `resetPassword`. Issue the caller a fresh token pair so their own session survives.

---

### H3 — Malformed IDs return 500 and leak filesystem paths and source code

**Severity:** HIGH · **[VERIFIED LIVE]**

**File / Function:** `backend/src/repositories/BaseRepository.ts:8–12` · `findById`
**Exposed by:** `backend/src/middleware/errorHandler.ts:41` · affects every `/:id` route

**Problem**
No route validates that `:id` is a UUID, so a non-UUID reaches Prisma and throws `PrismaClientValidationError`. The error handler only maps `PrismaClientKnownRequestError` code `P2002`; everything else falls through to a 500 that echoes `err.message` whenever `NODE_ENV !== 'production'`.

**Root cause**
Two gaps compounding: no params validation on `/:id` routes, and an error handler with a single Prisma mapping.

**Why it matters**
Two problems. A user-triggerable 400 is reported as a server fault, which poisons error monitoring and makes real incidents hard to spot. And the response body discloses the absolute path of the source tree plus an excerpt of the file — free reconnaissance on any staging or preview deployment.

**Evidence / reproduction**
Verified across three route families; the body is the leak:

```
GET /api/budgets/not-a-uuid       -> 500
GET /api/goals/not-a-uuid         -> 500
GET /api/transactions/abc         -> 500

{"message":"\nInvalid `this.modelDelegate.findUnique()` invocation in
/Users/<user>/Desktop/all codes/Projects/SpendSense/backend/src/repositories/
BaseRepository.ts:9:31\n\n  8 async findById(id: string) ...
```

**Recommended fix**
Add a shared `z.object({ params: z.object({ id: z.string().uuid() }) })` validator to every `/:id` route. In the error handler, map `PrismaClientValidationError` and `P2025` to 400/404, and never echo `err.message` for unmapped errors — log it with a correlation id and return that id instead.

---

### H4 — Unvalidated `sortBy` crashes the transactions list; oversize uploads return 500

**Severity:** HIGH · **[VERIFIED LIVE]**

**File / Function:** `backend/src/validators/transaction.ts:58` · `backend/src/repositories/TransactionRepository.ts:71–73` · `backend/src/middleware/upload.ts:38–40`

**Problem**
`sortBy: z.string().default('date')` accepts any string and is spread directly into `orderBy: { [sortBy]: sortOrder }`. Prisma rejects unknown fields with a validation error, producing a 500. Separately, Multer's `LIMIT_FILE_SIZE` error is never handled, so a 6 MB upload also yields a 500 rather than the 400 the UI expects.

**Root cause**
An open-ended `z.string()` where an enum was needed, plus no Multer branch in the global error handler.

**Why it matters**
Not injection — Prisma parameterises — but a trivially reachable crash on an authenticated endpoint, and a broken error message on the receipt path where the frontend reads `error.response.data.message` to show the user something useful.

**Evidence / reproduction**
```
GET /api/transactions?sortBy=bogusColumn  -> 500
```
Any user editing the URL, or a future UI column whose key does not match a schema field, hits this.

**Recommended fix**
Change to `z.enum(['date','amount','merchant','createdAt'])`. Add a Multer error branch in the error handler mapping `LIMIT_FILE_SIZE` to 400 with a size-specific message.

---

### H5 — Goal contributions are a non-atomic read-modify-write

**Severity:** HIGH

**File / Function:** `backend/src/services/goalService.ts:204–209` · `contributeToGoal`
**Related:** `backend/src/repositories/GoalRepository.ts:19–26` · `updateBalance`

**Problem**
`const newAmount = Number(goal.currentAmount) + amount` reads in one query, computes in JavaScript, and writes in a second query, with no transaction, no row lock and no optimistic-concurrency check. The intermediate value is a float, and `updateBalance` takes a `number` parameter into a `Decimal(12,2)` column.

**Root cause**
Balance is modelled as a mutable scalar rather than as a derived value over an append-only ledger. `prisma.$transaction` is not used anywhere in the codebase.

**Why it matters**
Classic lost update. Two concurrent contributions both read the same starting balance and the second write overwrites the first — the money is simply gone from the record. Because there is no contribution ledger (the model stores only a running `currentAmount`), the loss is undetectable and unreconstructable after the fact.

**Scenario**
Balance ₹10,000. Two ₹500 contributions land together — from a double-tapped button or two devices. Both read 10,000, both write 10,500. The user contributed ₹1,000 and the goal shows ₹10,500.

**Recommended fix**
Use `data: { currentAmount: { increment: amount } }` so the database performs the addition atomically in `Decimal`. Add a `GoalContribution` table so contributions are an auditable ledger rather than a mutated scalar.

---

### H6 — Transaction mutations do not invalidate dashboard, budget or analytics caches

**Severity:** HIGH

**File / Function:** `frontend/src/services/transactions.ts:85–115` · `useCreateTransaction`, `useUpdateTransaction`, `useDeleteTransaction`

**Problem**
All three invalidate only `['transactions']`. Every other mutation module in the codebase — budgets, goals, subscriptions — correctly also invalidates `['dashboard']`. Nothing anywhere invalidates `['analytics']`, and nothing invalidates `['budgets']` when a transaction changes, even though budget `spent` is computed entirely from transactions. With `staleTime: 5 * 60 * 1000` in `App.tsx:28`, stale values persist for five minutes.

**Root cause**
Cache invalidation is duplicated per-module by hand rather than centralised, so one module drifted from the others.

**Why it matters**
This is the bug users will hit on their first session. Recording an expense is the core action of the product, and the numbers it is supposed to change do not change.

**Scenario**
Add a ₹2,000 expense. The transaction list updates. Navigate to Dashboard — old balance, old monthly expenses, old health score. Navigate to Budgets — the budget you just blew through still reads "Safe". Both correct themselves five minutes later, which reads as data loss followed by spontaneous recovery.

**Recommended fix**
Add `['dashboard']`, `['budgets']` and `['analytics']` to the `onSuccess` of all three transaction mutations. A small shared `invalidateFinancialViews(queryClient)` helper would keep the three call sites honest.

---

### H7 — `currency` is silently discarded when creating a transaction

**Severity:** HIGH · **[VERIFIED LIVE]**

**File / Function:** `backend/src/validators/transaction.ts:4–25` · `createTransactionSchema`

**Problem**
The create schema has no `currency` field — though `updateTransactionSchema` at line 30 does, and `transactionService.create` accepts one, and the frontend's `CreateTransactionData` declares one. Zod strips unknown keys by default, so the value is dropped without error and the column takes its `INR` default.

**Root cause**
Zod's default non-strict object parsing silently discards unrecognised keys, so a schema omission produces no error anywhere in the stack.

**Why it matters**
Silent data corruption in a financial record. The user's stated currency is discarded and replaced with a different one, with a 201 success response. The amount is then displayed and summed under the wrong denomination.

**Evidence / reproduction**
Confirmed on the running server — request and stored record disagree:

```
POST /api/transactions  {"amount":1500.55, "currency":"USD", ...}
  -> 201  { "amount":"1500.55", "currency":"INR" }
```

**Recommended fix**
Add the `currency` enum to `createTransactionSchema` to match update. Consider `.strict()` on these schemas so an unrecognised field is a 400 rather than a silent drop — that single change would have surfaced this at the first request.

---

### H8 — Aggregates sum mixed currencies as if they were one unit

**Severity:** HIGH

**File / Function:** `backend/src/services/dashboardService.ts:97–124, 174–176` · `backend/src/services/analyticsService.ts:90–139` · `backend/src/services/budgetService.ts:43–53`

**Problem**
Every aggregation — `totalBalance`, `monthlyIncome`, `monthlyExpenses`, category breakdowns, budget `spent`, all analytics totals — runs `_sum: { amount: true }` with no currency grouping. The schema provides `baseCurrency`, `exchangeRate` and `convertedAmount` on Transaction, Budget, Goal and Subscription; not one of those twelve columns is ever written or read anywhere in the codebase.

**Root cause**
The multi-currency data model was designed but never implemented. No rate provider, no conversion step, no aggregation strategy.

**Why it matters**
Once more than one currency exists in an account, every number the product exists to show is wrong, with no indication that anything is amiss. The health score, savings rate and budget status are all derived from these sums.

**Scenario**
A user records ₹50,000 income and a $100 expense. The dashboard reports a balance of 49,900 — subtracting dollars from rupees. `H7` currently masks this by forcing everything to INR on create, so **fixing `H7` alone would expose this bug rather than resolve it. The two must be addressed together.**

**Recommended fix**
Pick one of two honest positions:

- **Implement it** — store `convertedAmount` in the user's `preferredCurrency` at write time using a rate provider, persist `exchangeRate`, and aggregate on `convertedAmount`.
- **Drop it** — remove the `Currency` enum from per-record models, keep a single account currency on `User`, and delete the three unused columns from four models.

---

### H9 — Refresh-token rotation has no reuse detection and is not atomic

**Severity:** HIGH

**File / Function:** `backend/src/services/authService.ts:109–141` · `refresh`

**Problem**
Rotation deletes the old row then creates a new one as two separate statements outside a transaction. When a stolen token that has already been rotated is presented, the lookup simply misses and returns a generic 401 — the theft is neither detected nor acted upon, and the legitimate user's current token family stays valid.

**Root cause**
Rotation was implemented as a mechanical delete-and-reissue without the reuse-detection half of the pattern that gives it its security value.

**Why it matters**
Rotation without reuse detection provides much less protection than it appears to. The whole point of rotating is that a replayed old token is evidence of compromise; here that evidence is discarded. The non-atomic delete-then-create also means a crash between the two statements silently logs the user out on all devices.

**Scenario**
An attacker exfiltrates a refresh token and uses it once. The victim's next refresh fails with "Invalid or expired refresh token" and they are logged out — while the attacker holds a freshly rotated valid token. The system treats the victim as the anomaly.

**Recommended fix**
Wrap rotation in `prisma.$transaction`. Add a `familyId` and a `revokedAt` column; on presentation of a revoked token, revoke the entire family and log a security event. Pairs naturally with the hashing change in `C4`.

---

### H10 — Analytics loads the full transaction history and calls Gemini on every request

**Severity:** HIGH

**File / Function:** `backend/src/services/analyticsService.ts:55–59, 311` · `getAnalytics`

**Problem**
An unbounded `findMany` pulls every transaction the user has ever recorded, with `include: { category: true }` hydrating a full category object per row, then iterates the array three separate times. The handler then blocks on a Gemini call with no timeout, no cache and no rate limit before responding.

**Root cause**
Aggregation was done in JavaScript rather than SQL, and the AI call was placed inline in the request path. The code comment acknowledges the unbounded query and ships it anyway.

**Why it matters**
Memory grows without bound with account age. The AI call means every page view costs money and inherits Gemini's latency and availability; a hung upstream hangs the Express request indefinitely, since no `AbortSignal` is set.

**Scenario**
A three-year-old account with 15,000 transactions materialises 15,000 hydrated objects per request. A user refreshing the Analytics tab five times triggers five Gemini charges for identical data.

**Recommended fix**
Push aggregation into SQL via `groupBy` as `dashboardService` already does, and bound the window to 12 months with an explicit range parameter. Cache AI insights per user per day, generate them out-of-band, and put a timeout on the Gemini call.

---

### H11 — Receipt images are stored as base64 in Postgres and returned in list responses

**Severity:** HIGH

**File / Function:** `backend/src/services/receiptService.ts:39–49` · `uploadAndExtract`
**Related:** `backend/src/repositories/ReceiptRepository.ts:10–17` · `findByUserId`

**Problem**
A 5 MB upload is expanded to a ~6.7 MB base64 data URL and written into `Receipt.imageUrl`. `GET /api/receipts` selects whole rows, so every image is serialised into a single JSON response. The frontend's `useReceipts` fetches this list wholesale.

**Root cause**
A deliberate development shortcut (documented in a code comment) to avoid an object-storage dependency, with no follow-up path and nothing preventing it from reaching production.

**Why it matters**
A user with 50 receipts receives a ~335 MB response. Postgres row storage, backups, WAL and replication all inflate accordingly.

**Scenario**
Opening the receipts view on a modest account stalls the browser and may exhaust Node's heap while serialising the response.

**Recommended fix**
Immediately: add a `select` to `findByUserId` that omits `imageUrl`, and serve images from `GET /api/receipts/:id/image`. Properly: move to object storage and persist only a key.

---

### H12 — The test suite cannot detect any defect in this report

**Severity:** HIGH · **[VERIFIED LIVE]**

**File / Function:** `backend/src/tests/*.ts` · `backend/package.json:11` `test` script

**Problem**
Every suite reassigns repository singleton methods to inline stubs (`userRepository.findByEmail = async () => null`) and never restores them. Nothing exercises HTTP, middleware, validators, the error handler, or the database. "Tenant isolation" tests assert that a service returns `NotFoundError` when a stub returns a foreign `userId` — they verify the mock, not authorization. The newest suite, `passwordResetTest.ts`, is not referenced by the `test` script at all and never runs.

**Root cause**
Testing strategy targets the layer immediately below the code under test, mocking exactly the boundary where integration defects occur.

**Why it matters**
All 30 assertions pass against an application with five critical defects. A green suite is currently evidence of nothing, which is worse than no suite because it creates false confidence.

**Evidence / reproduction**
Confirmed by running `npm test`: every suite passes on the exact tree in which `C1` through `C5` were reproduced minutes earlier.

```
Passed: 2 | Failed: 0   (dashboard)
Passed: 4 | Failed: 0   (budget)
Passed: 7 | Failed: 0   (goal)
Passed: 9 | Failed: 0   (receipt & AI)
Passed: 7 | Failed: 0   (subscription)
```

**Recommended fix**
Adopt Vitest or Jest with Supertest against a disposable Postgres database. Cover, in order: the auth lifecycle including rotation and reuse; cross-tenant access to every `/:id` route with a second user's id; the money paths with the concrete cases in the Financial Logic section; and the password-reset flow end to end. Add `passwordResetTest.ts` to the script in the meantime.

---

## Medium Priority Issues

> Real bugs and architectural problems that do not immediately compromise the system.

---

### M1 — Subscriptions accept categories belonging to other users

**Severity:** MEDIUM
**File / Function:** `backend/src/services/subscriptionService.ts:151` and `:195` · `createSubscription`, `updateSubscription`

**Problem** — `categoryId` is assigned with no ownership check. `transactionService` (line 26) and `budgetService` (line 156) both verify `category.userId` before use; the subscription service does not.

**Root cause** — The ownership guard is duplicated by hand in three services and omitted in the fourth.

**Why it matters** — A user can attach another user's private category to their own subscription by supplying its UUID, causing that category's name and colour to be joined into their responses — a cross-tenant information leak, and an inconsistency in a rule the codebase otherwise enforces.

**Scenario** — Attacker obtains or guesses a private category id and creates a subscription with it; the response includes the victim's category name.

**Fix** — Apply the same guard used in `transactionService.create`. Better, extract it into one `assertCategoryAccessible(userId, categoryId)` helper used by all three services.

---

### M2 — Password complexity is enforced inconsistently across the three password paths

**Severity:** MEDIUM
**File / Function:** `backend/src/validators/auth.ts:18–24` vs `backend/src/validators/user.ts:8` and `:26`

**Problem** — Registration and reset require lowercase, uppercase, digit and symbol. `changePasswordSchema.newPassword` requires only `min(8)`, and `updateProfileSchema.password` likewise.

**Root cause** — The rule set is written out four separate times (three backend schemas, one frontend form) rather than shared.

**Why it matters** — The policy is trivially bypassed: register with a compliant password, then immediately change it to `aaaaaaaa`. A policy enforced at one of three doors is not a policy.

**Scenario** — Reproduced incidentally while verifying `C1` — `hijacked1` has no uppercase and no symbol, and was accepted.

**Fix** — Extract one `passwordSchema` in `validators/auth.ts` and import it into all password-accepting schemas.

---

### M3 — CORS is fully open and the rate limiter is not proxy-aware

**Severity:** MEDIUM
**File / Function:** `backend/src/app.ts:26` · `app.use(cors())` · `backend/src/middleware/rateLimiter.ts`

**Problem** — `cors()` with no options reflects every origin. No `app.set('trust proxy', …)` is configured, so behind Render or any load balancer `req.ip` resolves to the proxy address. Rate limiting is also applied only to `/api/auth`; nothing throttles receipt uploads, which cost Gemini calls.

**Root cause** — Middleware was mounted with library defaults and never configured per-environment.

**Why it matters** — Any site can call the API with a token it has obtained. In production the auth limiter will bucket all users into a single IP — 15 requests per 15 minutes across your entire user base, locking everyone out. The README's claim of "CORS filters" is not implemented.

**Scenario** — First deploy behind a proxy: sixteen users try to log in within a quarter hour and the rest see 429.

**Fix** — Pass an explicit origin allowlist from env. Set `trust proxy` to the specific hop count for your platform. Add a global limiter plus a stricter one on `/api/receipts/upload`.

---

### M4 — Reading the dashboard writes to the database

**Severity:** MEDIUM
**File / Function:** `backend/src/services/subscriptionService.ts:99–104` · `processSubscription`

**Problem** — Any subscription whose `nextRenewal` has passed is rolled forward and persisted mid-read. Because `dashboardService` calls `getSubscriptions`, `GET /api/dashboard` performs writes. The comment claims the update is "asynchronous in the background"; it is `await`ed inline.

**Root cause** — Roll-forward was implemented lazily in the read path instead of as a scheduled job.

**Why it matters** — GET requests are expected to be safe and are freely retried by browsers, proxies and React Query. Concurrent dashboard and subscription requests race on the same rows, and read latency now includes N writes.

**Scenario** — Dashboard and Subscriptions load together after a period of inactivity; both roll the same rows forward simultaneously.

**Fix** — Compute the effective renewal date in memory for the response and move persistence to a scheduled job. Correct the comment either way.

---

### M5 — Monthly renewals drift when the start date is after the 28th

**Severity:** MEDIUM
**File / Function:** `backend/src/services/subscriptionService.ts:46–66` · `calculateNextRenewal`

**Problem** — `nextDate.setMonth(nextDate.getMonth() + 1)` overflows when the target month is shorter. January 31 plus one month becomes March 2 or 3, and the drift compounds on each subsequent roll-forward. The yearly branch has the same issue for February 29.

**Root cause** — JavaScript `Date` month arithmetic overflows rather than clamping, and the original anchor day is not retained.

**Why it matters** — Renewal dates and "renews in N days" warnings become progressively wrong for any subscription billed on the 29th, 30th or 31st — a large share of real billing dates.

**Scenario** — Start date 2026-01-31, monthly. Expected 2026-02-28; produced 2026-03-03. Next roll gives 2026-04-03, and the anchor day is permanently lost.

**Fix** — Clamp to the last valid day of the target month, preserving the original anchor day for future periods. Note that `subscriptionTest.ts` tests only mid-month dates, so this passes today.

---

### M6 — `daysUntilRenewal` uses an absolute value, so past dates read as upcoming

**Severity:** MEDIUM
**File / Function:** `backend/src/services/subscriptionService.ts:108–109`

**Problem** — `Math.abs(nextRenewal.getTime() - now.getTime())` discards the sign. Active subscriptions are rolled forward first so they are usually positive, but inactive ones are not rolled forward and retain a past `nextRenewal`.

**Root cause** — `Math.abs` was likely added to avoid negative display values rather than handling the past-date case explicitly.

**Why it matters** — A subscription cancelled 100 days ago reports `daysUntilRenewal: 100`, indistinguishable from one renewing in 100 days. Any future feature that surfaces overdue items inherits the defect.

**Scenario** — Sorting or filtering inactive subscriptions by renewal proximity produces reversed ordering.

**Fix** — Drop `Math.abs` and let the value go negative for elapsed dates; use `Math.round` rather than `Math.ceil` so a same-day renewal is 0.

---

### M7 — Pagination has no tiebreaker, so rows repeat and vanish across pages

**Severity:** MEDIUM
**File / Function:** `backend/src/repositories/TransactionRepository.ts:69–85` · `findFiltered`

**Problem** — `orderBy` uses a single key. The default sort is `date`, which is a day-granular value in practice, so ties are extremely common and Postgres does not guarantee a stable order between queries.

**Root cause** — Offset pagination over a non-unique sort key.

**Why it matters** — With ten transactions on the same date, paging can show the same row twice and omit another entirely. In a ledger this reads as duplicated or missing money.

**Scenario** — A user imports twelve transactions all dated 2026-08-01, then pages through at `limit=10`. Rows 1–10 and 11–12 are not guaranteed to be disjoint.

**Fix** — Always append a unique secondary sort: `orderBy: [{ [sortBy]: sortOrder }, { id: 'desc' }]`. `dashboardService` already models the pattern at line 156.

---

### M8 — Budget "exceeded" is reported inconsistently at exactly 100%

**Severity:** MEDIUM
**File / Function:** `backend/src/services/budgetService.ts:106` vs `:131` · `formatBudgetStats`

**Problem** — The response carries two contradictory signals for the same state: `predictions.status` is `'Exceeded'` when `spent >= amount`, while `isExceeded` is `percentageUsed > 100`. At exactly 100% they disagree.

**Root cause** — Two independently written predicates for the same concept in one function.

**Why it matters** — The UI renders one or the other depending on the component, so the same budget can show "Exceeded" on the detail view and a non-exceeded state in the list. Spending exactly to the limit is a common, deliberate user behaviour.

**Scenario** — Budget ₹1,000, spent ₹1,000 → `status: 'Exceeded'`, `isExceeded: false`. `budgetTest.ts` tests 25%, 85% and 120% and never the boundary.

**Fix** — Derive both flags from one predicate. Treat spending exactly to the limit as "at limit" rather than exceeded, and say so in both fields.

---

### M9 — The health score double-counts spending when an overall budget coexists with category budgets

**Severity:** MEDIUM
**File / Function:** `backend/src/services/dashboardService.ts:318–344`

**Problem** — The loop adds `monthlyExpenses` in full for a budget with a null `categoryId`, and adds each category's spend for category budgets. A user with both gets the same spending counted twice in `totalSpentAgainstBudget`.

**Root cause** — Overall and category budgets are summed into one ratio rather than evaluated as distinct components.

**Why it matters** — The adherence ratio is inflated, so the 30-point budget component collapses and the headline health score understates the user's position — for the users who are budgeting most carefully.

**Scenario** — Overall budget ₹50,000 plus a ₹10,000 Food budget; ₹20,000 spent, ₹8,000 of it on food. Spend is counted as ₹28,000 against a ₹60,000 limit rather than ₹20,000.

**Fix** — Evaluate overall and category budgets as separate components, or exclude categories already covered by a specific budget from the overall figure.

---

### M10 — Dashboard budget insights ignore each budget's own date range

**Severity:** MEDIUM
**File / Function:** `backend/src/services/dashboardService.ts:387–405` vs `backend/src/services/budgetService.ts:37–54`

**Problem** — `budgetService.calculateSpending` correctly filters transactions to the budget's `startDate`–`endDate`. The dashboard reuses `categorySpending`, which is fixed to the current calendar month, then compares it against the same budgets.

**Root cause** — The dashboard reuses a pre-computed current-month aggregate rather than calling the budget service's own spend calculation.

**Why it matters** — Any budget that is not exactly one calendar month produces different numbers on the Dashboard and the Budgets page. Two screens disagree about whether the user has exceeded a limit, with no way to tell which is right.

**Scenario** — A quarterly ₹90,000 budget is judged against one month of spending on the dashboard, so it almost never triggers a warning there while the Budgets page correctly shows it at risk.

**Fix** — Have the dashboard call the same `calculateSpending` helper per budget, or restrict dashboard insights to budgets whose range matches the current month.

---

### M11 — Deleting a category cascades into deleting transactions and budgets

**Severity:** MEDIUM
**File / Function:** `backend/prisma/schema.prisma:141` and `:166` · `onDelete: Cascade`

**Problem** — `Transaction.category` and `Budget.category` both cascade on delete. `Subscription.category` uses `SetNull` — three relations to the same parent, two behaviours.

**Root cause** — Cascade was applied uniformly from the `User` relation pattern without distinguishing ownership from reference.

**Why it matters** — Removing a category would silently destroy financial history. It is latent today only because no category-delete endpoint exists — `categoryRoutes` exposes GET alone. Any future "manage categories" feature detonates it, and a stray `prisma studio` deletion does so now.

**Scenario** — A user tidies up an unused "Investment" category and loses every transaction ever filed under it.

**Fix** — Change both to `onDelete: Restrict`, or make `categoryId` nullable with `SetNull` and treat null as "Uncategorised" — which the dashboard already handles at line 222.

---

### M12 — Scanned receipts are never linked to the transaction they create

**Severity:** MEDIUM
**File / Function:** `frontend/src/features/receipts/ReceiptScanner.tsx:110–118` · `handleTransactionSave`

**Problem** — The upload response returns `receipt.id`, and both `createTransactionSchema` and the `Transaction.receiptId` relation support the link — but the scanner never passes it. The `Receipt ↔ Transaction` relation is therefore always null.

**Root cause** — The backend half of the feature was built; the frontend never wired the returned id into the create payload.

**Why it matters** — The product's headline feature is only half wired. Users cannot see the source image from a transaction, receipts accumulate unlinked (each carrying a multi-megabyte base64 blob per `H11`), and `ReceiptRepository.findUnlinked` — written for exactly this purpose — is dead code because everything is unlinked.

**Scenario** — Scan ten receipts, save all ten transactions, then try to review the original image for one of them. There is no path from the transaction to the receipt.

**Fix** — Hold the returned `receipt.id` in state and include it as `receiptId` in the create payload.

---

### M13 — AI-supplied dates and amounts reach Prisma unvalidated

**Severity:** MEDIUM
**File / Function:** `backend/src/services/receiptService.ts:46–47` · `backend/src/services/aiService.ts:106–108`

**Problem** — `parseAIResponse` checks only `typeof parsed.date === 'string'`, so any string survives; `new Date('sometime last week')` yields `Invalid Date`, which Prisma rejects. Similarly `amount` is checked for `> 0` but has no ceiling, so a hallucinated `1e15` overflows `Decimal(12,2)`.

**Root cause** — Type-shape checking was used where value validation was needed. LLM output is treated as trusted once it parses as JSON.

**Why it matters** — A model deviation turns into an unhandled 500 after the user has already waited through the upload and the AI round trip — and after the Gemini call has been paid for. The scanner shows "Scan Failed" with a Prisma message.

**Scenario** — A blurry receipt yields `"date": "unknown"`; the request 500s instead of degrading to a null date the user can fill in.

**Fix** — Validate the parsed object with a Zod schema — `date` as a `YYYY-MM-DD` regex plus a real-date refinement, `amount` with an explicit maximum — and fall back to null per field rather than failing the request.

---

### M14 — AI failure is indistinguishable from a receipt with nothing on it

**Severity:** MEDIUM
**File / Function:** `backend/src/services/aiService.ts:77–85, 113–116` · `getEmptyExtraction`

**Problem** — A network error, an auth failure, a quota rejection and unparseable output all return the same all-null object, and the endpoint reports 201 success. No error signal reaches the client.

**Root cause** — Graceful degradation was implemented as a silent fallback with no status channel.

**Why it matters** — The UI displays "Receipt Scanned Successfully" over a form where every field is empty. The user retries, is charged again, and gets the same result with no indication that anything is wrong.

**Scenario** — An expired `GEMINI_API_KEY` produces cheerful success banners indefinitely, and nothing surfaces the outage.

**Fix** — Add an `extractionStatus: 'ok' | 'failed' | 'empty'` field to the result and have the scanner distinguish the three cases.

---

### M15 — Same-field data arrives as a string on one endpoint and a number on another

**Severity:** MEDIUM · **[VERIFIED LIVE]**
**File / Function:** `backend/src/controllers/transactionController.ts` (raw Prisma passthrough) vs `backend/src/services/dashboardService.ts:62` `safeDecimal`

**Problem** — Transaction endpoints return Prisma models directly, so `Decimal` serialises to a JSON string. Dashboard, budget, goal and subscription services convert through `Number()` first and emit JSON numbers. The frontend types declare `number` everywhere, including `ReceiptRecord.extractedAmount`.

**Root cause** — There is no serialisation layer; each controller decides independently whether to pass Prisma models through or map them.

**Why it matters** — Any client-side arithmetic on a transaction amount concatenates instead of adding, and TypeScript cannot catch it because the declared types are wrong. It also means the API has no single answer to "how is money represented".

**Evidence / reproduction** — Confirmed on the wire — the same value, two encodings:

```
GET /api/transactions  ->  amount: "1500.55"          (string)
GET /api/dashboard     ->  monthlyExpenses: 1500.55   (number)
```

**Fix** — Choose one representation and apply it in a serialisation layer all controllers share. Minor-units integers or decimal strings are both defensible; mixing them is not. Then correct the frontend types to match.

---

### M16 — Budget creation silently drops the chosen currency

**Severity:** MEDIUM
**File / Function:** `backend/src/services/budgetService.ts:162–168` · `create`

**Problem** — The validator accepts `currency` and the DTO declares it, but the object passed to `budgetRepository.create` omits it, so the column takes its `INR` default. `update` at line 241 does forward it via the spread — so creating and then editing a budget changes its currency.

**Root cause** — `create` enumerates fields explicitly and missed one; `update` uses a spread and does not.

**Why it matters** — Same silent-discard class as `H7`, in a second module, with the added oddity that create and update disagree.

**Scenario** — Create a USD budget — stored as INR. Edit any field with `currency: 'USD'` in the payload — now stored as USD, and its `spent` total is still summed from INR transactions.

**Fix** — Include `currency: data.currency` in the create call, and resolve the broader question in `H8`.

---

### M17 — Budget stats run one aggregate query per budget

**Severity:** MEDIUM
**File / Function:** `backend/src/services/budgetService.ts:186–191` · `findAll` → `formatBudgetStats` → `calculateSpending`

**Problem** — Each budget triggers its own `transaction.aggregate`. Twelve budgets means thirteen queries per page load. `Promise.all` makes them concurrent, not fewer.

**Root cause** — Per-record stat computation with no batching layer.

**Why it matters** — A textbook N+1 on a page that loads on every visit to Budgets, and again indirectly from the dashboard. It also opens N connections at once against a serverless Postgres connection limit.

**Scenario** — Twelve monthly category budgets — a normal configuration — produce thirteen round trips where two would do.

**Fix** — Where budget ranges coincide, one `groupBy(['categoryId'])` over the union range serves all of them; otherwise batch by distinct range.

---

### M18 — Fetching one subscription loads all of them, twice

**Severity:** MEDIUM
**File / Function:** `backend/src/services/subscriptionService.ts:169–180` and `:207–213`

**Problem** — `getSubscriptionById` fetches by id, then calls `findByUserId` and scans the array to find the same record with its category joined. `updateSubscription` repeats the pattern. `createSubscription` similarly loads every subscription to check for a duplicate name in JavaScript.

**Root cause** — The repository has no `findByIdWithCategory`, so the list method is reused as a workaround.

**Why it matters** — Three round trips where one `findUnique` with an `include` would do, scaling with the user's subscription count on a single-record read.

**Scenario** — Editing one of forty subscriptions loads all forty twice.

**Fix** — Add `findByIdWithCategory` to the repository. Replace the duplicate check with a scoped `findFirst` using `mode: 'insensitive'`.

---

### M19 — `userController` bypasses the service and repository layers entirely

**Severity:** MEDIUM
**File / Function:** `backend/src/controllers/userController.ts:3, 18, 47, 82, 103, 117, 130`

**Problem** — Alone among the nine controllers, this one imports `prisma` and issues queries directly. There is no `userService`. All the business rules — uniqueness checks, password verification, cascade deletion, data export shaping — live in the HTTP layer.

**Root cause** — The user-management feature was added after the architecture was established and did not follow it.

**Why it matters** — This is precisely where `C1`, `H1` and `H2` live, which is not a coincidence: the layer that carries the security invariants was skipped, so the invariants were skipped too. It is also untestable by the existing repository-mocking strategy, which is why none of those three defects has a test.

**Scenario** — Adding a "revoke sessions on password change" rule requires touching a controller, and nothing prevents the next endpoint from omitting it again.

**Fix** — Introduce `userService` over `UserRepository` and move all five handlers' logic into it, matching the other eight controllers.

---

### M20 — The repository base class discards all Prisma typing

**Severity:** MEDIUM
**File / Function:** `backend/src/repositories/BaseRepository.ts:2–5`

**Problem** — `protected modelDelegate: Record<string, Function>` erases the delegate's type. Every call returns `any`, and the declared return types are unchecked assertions rather than verified facts.

**Root cause** — A generic base class was written over heterogeneous Prisma delegates by erasing their types rather than parameterising over them.

**Why it matters** — The project runs `strict: true` and both workspaces typecheck cleanly — but that guarantee stops at the repository boundary, which is exactly where a wrong field name or a missing `where` clause becomes a data-integrity bug. `H4`'s crash would have been a compile error under a typed delegate.

**Scenario** — A typo in a `where` key compiles cleanly and fails at runtime as a 500.

**Fix** — Make the base class generic over the delegate type, or drop it — the subclasses' bespoke methods already carry most of the value, and Prisma's own client is a well-typed data-access layer.

---

### M21 — Goal completion probability reports "High" for goals with no progress

**Severity:** MEDIUM
**File / Function:** `backend/src/services/goalService.ts:60–66`

**Problem** — The threshold is `progressPercentage >= 100 - (monthsRemaining * 5)`. Beyond twenty months remaining the threshold goes negative, so every goal satisfies it. Nothing in the model considers the user's actual income or savings rate.

**Root cause** — A placeholder heuristic (the code comment says "would normally use historical savings data") shipped as a user-facing prediction.

**Why it matters** — A financial product telling a user they are highly likely to reach a goal they have not started saving for is worse than showing nothing — it is confident and wrong, in a domain where users act on the advice.

**Scenario** — ₹10,00,000 target, three years out, ₹0 saved → threshold −80, so 0% progress qualifies as "High".

**Fix** — Compare the required monthly contribution against the user's observed monthly savings from `dashboardService`. If that data is unavailable, return null rather than a guess.

---

## Low Priority Issues

> Minor bugs, UX problems, dead code, and maintainability concerns.

---

### L1 — The contribution modal collects a date that is thrown away

**Severity:** LOW
**File:** `frontend/src/features/goals/GoalContributionModal.tsx:11` · `frontend/src/services/goals.ts:68–71`

**Problem** — The form validates a required `date`, but `contributeGoal` sends only `{ amount }`, and the backend has nowhere to put a date — `Goal` stores a single running `currentAmount`.

**Why it matters** — The UI implies a dated contribution history that does not exist. Users will backdate a contribution and reasonably expect it to appear that way.

**Fix** — Remove the field, or add the `GoalContribution` ledger proposed in `H5` and persist it.

---

### L2 — Password reset URL is hardcoded to localhost

**Severity:** LOW
**File:** `backend/src/services/EmailService.ts:59`

**Problem** — `const resetUrl = \`http://localhost:3000/reset-password?token=${rawToken}\``, with no environment override.

**Why it matters** — Every production reset email would send users to their own machine. Low only because `C5` means no email is sent today; **it becomes a release blocker the moment `C5` is fixed.**

**Fix** — Add `APP_URL` to the env schema and require it when `NODE_ENV === 'production'`.

---

### L3 — Existing reset tokens survive a password change

**Severity:** LOW
**File:** `backend/src/services/authService.ts:201–238` · `resetPassword`

**Problem** — Only the token being redeemed is marked used. Other outstanding tokens for the same user remain valid for their full hour, and `forgotPassword` never invalidates prior tokens when issuing a new one. Steps 7–9 also run as three unwrapped statements — a failure after step 7 leaves the password changed and the token reusable.

**Why it matters** — A user who requests reset three times leaves three live keys. Standard practice is one valid token at a time.

**Fix** — Call `passwordResetTokenRepository.deleteManyByUserId` — it already exists and is unused — at the start of `forgotPassword` and after a successful reset. Wrap steps 7–9 in `prisma.$transaction`.

---

### L4 — The login-endpoint guard in the Axios interceptor never matches

**Severity:** LOW
**File:** `frontend/src/services/api.ts:52`

**Problem** — It tests `originalRequest.url?.includes('/api/auth/login')`, but with `baseURL` in play `url` is `/auth/login`. The same stale-prefix mistake as `C3`, here failing open instead of loud.

**Why it matters** — A failed login attempts a token refresh and replays the login. Harmless today because the refresh usually fails too, but the guard provides none of the protection it appears to.

**Fix** — Match on `/auth/login` and `/auth/register`.

---

### L5 — Object URLs are never revoked in the receipt scanner

**Severity:** LOW
**File:** `frontend/src/features/receipts/ReceiptScanner.tsx:63, 120–127`

**Problem** — `URL.createObjectURL(file)` is called on every selection; `handleReset` clears the state but never calls `URL.revokeObjectURL`.

**Why it matters** — Each blob is retained for the page's lifetime. Scanning twenty 4 MB receipts in a session pins ~80 MB. `Profile.tsx:137` does this correctly, so the pattern is known in the codebase.

**Fix** — Revoke the previous URL in `handleFileSelect` and in a `useEffect` cleanup.

---

### L6 — `formatCurrency` throws on an unrecognised currency code

**Severity:** LOW
**File:** `frontend/src/utils/formatCurrency.ts:2–7`

**Problem** — `Intl.NumberFormat` raises `RangeError` for an invalid or empty currency code, and the helper has no guard or try/catch. The `amount: number` parameter is also a lie for transaction amounts, which arrive as strings per `M15`.

**Why it matters** — An unhandled exception during render blanks the subtree — there is no error boundary in `App.tsx`. A null amount renders as "₹NaN".

**Fix** — Coerce with `Number(amount)`, guard `Number.isFinite`, default the code to `INR` when unrecognised, and wrap in try/catch. Add a top-level error boundary.

---

### L7 — Modals have no dialog semantics, focus trap or Escape handling

**Severity:** LOW
**File:** `frontend/src/features/goals/GoalContributionModal.tsx` · `features/subscriptions/SubscriptionFormModal.tsx` · `features/budgets/BudgetForm.tsx`

**Problem** — No `role="dialog"`, `aria-modal`, focus trap, focus restoration or Escape-to-close anywhere in the frontend — a repository-wide search returns nothing. Across the app there is one `aria-label` for 84 buttons, and 28 `htmlFor` bindings for 40 inputs.

**Why it matters** — Keyboard and screen-reader users cannot reliably operate the modals, and icon-only buttons are unlabelled. For a finance product this is likely an accessibility-compliance obligation, not just a nicety.

**Fix** — Build one `Modal` primitive with the dialog semantics and reuse it. Audit icon-only buttons for labels and bind the remaining twelve inputs.

---

### L8 — `EMAIL_FROM` in `.env.example` is malformed for dotenv

**Severity:** LOW
**File:** `backend/.env.example` (last line)

**Problem** — `EMAIL_FROM="SpendSense" <no-reply@spendsense.app>` — dotenv stops at the closing quote, so the value is `SpendSense` and the address is lost.

**Why it matters** — Anyone following the example configures an invalid From address and nodemailer rejects the send, which currently surfaces as the 500 in `C5`.

**Fix** — Quote the whole value: `EMAIL_FROM="SpendSense <no-reply@spendsense.app>"`.

---

### L9 — The Notification feature is a complete dead branch

**Severity:** LOW
**File:** `backend/prisma/schema.prisma:220–236` · `backend/src/repositories/NotificationRepository.ts`

**Problem** — A `Notification` model, a `NotificationType` enum, a full repository, and five boolean preference columns on `User` exist. There is no service, controller or route, and nothing ever writes a notification. The Profile page lets users toggle preferences that control nothing.

**Why it matters** — The settings actively mislead — a user disabling "Budget alerts" believes they have changed a behaviour. Note that `markAsRead(id)` takes no `userId`, so wiring it up as written would introduce an IDOR.

**Fix** — Either implement it or remove the model, repository and toggles. If implemented, scope `markAsRead` by `userId`.

---

### L10 — Six unused repository methods and three unreachable filters

**Severity:** LOW
**Files:** `ReceiptRepository.findUnlinked` · `BudgetRepository.findActiveByCategory` · `SubscriptionRepository.findUpcomingRenewals` · `CategoryRepository.findByNameAndUser` · `TransactionRepository.getCategorySpending` · `PasswordResetTokenRepository.deleteManyByUserId`

**Problem** — None is called. `TransactionFilters` also declares `minAmount` and `maxAmount`, implemented in the repository but absent from the query validator, so they are unreachable over HTTP — while the README advertises "amount constraints".

**Why it matters** — Dead code reads as available capability. `dashboardService` reimplements `getCategorySpending` inline against `prisma` directly rather than using the repository method written for it.

**Fix** — Delete what is unused; wire up what should exist — `deleteManyByUserId` resolves `L3`, and adding `minAmount`/`maxAmount` to the validator delivers a documented feature.

---

### L11 — Unreachable branch in the goal contribution guard

**Severity:** LOW
**File:** `backend/src/services/goalService.ts:200–207`

**Problem** — `if (amount <= 0) throw` is followed by `if (newAmount < 0) throw`. Since `currentAmount` is non-negative and `amount` is positive, the second condition cannot hold. The validator rejects non-positive amounts before either check runs.

**Why it matters** — The dead branch implies withdrawals were once intended. Today there is no way to correct a mistaken contribution — only a direct `currentAmount` overwrite via `updateGoal`, which bypasses all guards.

**Fix** — Remove the branch, or support negative contributions deliberately and let the guard do real work.

---

### L12 — Spending-trend buckets are returned without rounding

**Severity:** LOW
**File:** `backend/src/services/dashboardService.ts:262–263, 431`

**Problem** — `bucket.income += val` accumulates floats across all transactions in a day. Every other figure in the response is passed through `toFixed`; `spendingTrend` is not.

**Why it matters** — Values like `30.000000000000004` reach the chart. Recharts tooltips render the raw number.

**Fix** — Round each bucket when building the array, consistent with the rest of the payload.

---

### L13 — Analytics averages collapse when a transaction is backdated

**Severity:** LOW
**File:** `backend/src/services/analyticsService.ts:225–233`

**Problem** — `daysTracked` is measured from the earliest transaction to now, and `dailySpending = totalExpense / daysTracked`. There is no lower bound on transaction dates in the validator.

**Why it matters** — One transaction dated ten years ago drives the daily average toward zero, and `weeklySpending` — derived as `dailySpending * 7` rather than measured — inherits it.

**Fix** — Compute averages over an explicit window, and bound transaction dates in the validator to a sensible range.

---

### L14 — Stray scratch files and unused dependencies

**Severity:** LOW
**Files:** `test.ts` (repo root) · `backend/fix-tests.js` · `backend/src/controllers/userController.ts:2`

**Problem** — A two-line scratch file sits at the repository root. `fix-tests.js` is a one-off codemod that rewrites the test suite in place. `userController` imports `bcryptjs` and never uses it. `winston`, `clsx` and `tailwind-merge` are declared dependencies with zero imports — and the README credits Winston as the logging layer, while the backend uses sixteen raw `console.*` calls.

**Why it matters** — A committed codemod that rewrites tests is a live footgun. Unused dependencies inflate the install and misrepresent the stack.

**Fix** — Delete `test.ts` and `fix-tests.js`, drop the unused imports and packages, and either adopt Winston with structured levels and request correlation or remove it from both `package.json` and the README.

---

## Informational

| Ref | Finding |
|---|---|
| **I1** | **bcrypt cost factor is 10.** Acceptable but below the current recommendation of 12 for a financial application (`utils/password.ts:3`). Cheap to raise; verify login latency stays acceptable. |
| **I2** | **Access tokens carry no issuer or audience claims** and `verifyAccessToken` does not assert that `sub` is present, returning `{ userId: undefined }` for a validly signed token without one. Separate secrets make this unexploitable today. |
| **I3** | **Financial data is sent to Google Gemini on every analytics load** (`analyticsService.ts:302–311`) with no user consent, opt-out or privacy disclosure. Category names and aggregate figures leave your infrastructure. Worth an explicit product decision and a privacy note. |
| **I4** | **Receipt images are attacker-influenced input to an LLM.** The user reviews every extraction before saving, which is the right design and correctly implemented — no transaction is ever auto-created. Worth keeping that property under test so it is not lost to a future "quick save" button. |
| **I5** | **`@@index([token])` on `RefreshToken` is redundant** — `@unique` already creates one (`schema.prisma:94`). Harmless, costs a little write throughput. |
| **I6** | **Both workspaces typecheck cleanly under `strict: true`,** and the frontend contains 88 `any` annotations concentrated in error handlers and API response shapes. Typing the response envelopes would recover most of the lost safety. |

---

## Security Findings

> Consolidated view. Full detail in the severity sections above.

### Authentication and session management

- **`C1`** Password and email changeable with no re-authentication — account takeover from any token compromise.
- **`C2`** Login fails with 409 whenever two tokens are minted in the same second.
- **`C3`** Logout never reaches the server; refresh tokens are never revoked.
- **`C4`** Refresh tokens stored in plaintext at rest, while reset tokens are correctly hashed.
- **`H2`** Password change leaves all existing sessions valid.
- **`H9`** Rotation without reuse detection; not atomic.
- **`I2`** No issuer/audience claims; `sub` presence unverified.

**Correctly done:** access tokens are short-lived at 15 minutes, secrets are separate for access and refresh, bcrypt is used properly with a per-password salt, and login returns a uniform "Invalid email or password" for both unknown accounts and wrong passwords.

### Password reset

- **`C5`** Enumeration oracle via differential status codes; feature entirely non-functional.
- **`L3`** Prior reset tokens are not invalidated; the update is not transactional.

**Correctly done:** 32 bytes of `crypto.randomBytes` entropy, SHA-256 hashed at rest, one-hour expiry, single-use via `usedAt`, no auto-login after reset, and all sessions revoked on success. The design is sound — the delivery path around it is what fails.

### Authorization and tenant isolation

| Resource | Scoped by userId | Notes |
|---|---|---|
| Transactions | Yes | Ownership checked on read, update and delete; category ownership verified |
| Budgets | Yes | Ownership and category ownership both checked |
| Goals | Yes | Checked on every path including contribute |
| Receipts | Yes | Checked on read and delete |
| Subscriptions | **Partial** | `M1` record scoped, but `categoryId` accepted unchecked |
| Categories | Yes | Read-only endpoint returning system plus own categories |
| User profile | Yes | Always `req.user.id`; never accepts an id from the client |
| Refresh tokens | Yes | Looked up by token value, not by a client-supplied id |
| Notifications | N/A | `L9` unreachable; `markAsRead` would be an IDOR if wired up |

**No classic IDOR was found.** Every service compares `record.userId !== userId` before returning or mutating, and no endpoint accepts a user id from the request body or path. This is the strongest part of the security posture, and it is consistent enough that `M1` stands out as an oversight rather than a pattern.

### API surface

- **`H3`** Absolute filesystem paths and source excerpts returned in 500 bodies outside production.
- **`M3`** Open CORS; rate limiter not proxy-aware; no global or upload-specific limits.
- **`M2`** Password complexity enforced on one of three paths.

**Token storage.** Access and refresh tokens live in `localStorage`, so any XSS yields a 30-day session. Combined with `C1` this escalates to permanent takeover. Moving the refresh token to an `httpOnly`, `Secure`, `SameSite=Strict` cookie would close the escalation path; note this reintroduces CSRF considerations, currently a non-issue precisely because auth is header-based.

**Injection.** No raw SQL anywhere; all queries go through Prisma with parameterised inputs. No `dangerouslySetInnerHTML` in the frontend. `profilePictureUrl` accepts an arbitrary string but is only ever used as an `<img src>`, which is not an XSS vector; it should still be constrained to `https:` and `data:image/` before any future use in an anchor.

**Body limits.** `express.json()` defaults to 100 kB, which is adequate and effectively bounds `profilePictureUrl`. Uploads are correctly capped at 5 MB with a MIME allowlist and memory storage — though `H4` the limit error surfaces as a 500. MIME type is taken from the client header and not verified against magic bytes; low risk given the buffer only reaches Gemini, but worth adding.

**Secrets.** `backend/.env` is correctly gitignored and no secret is committed. The env schema validates presence of all required secrets at boot and exits with a clear message — a genuinely good pattern. It does not enforce a minimum entropy on JWT secrets beyond 8 characters.

---

## Database Findings

- **`M11` Cascade behaviour is inconsistent and destructive.** `Transaction.category` and `Budget.category` cascade; `Subscription.category` sets null. Deleting a category would destroy financial history.

- **`C4` Sensitive tokens stored unhashed** while the analogous table hashes correctly.

- **`H5` Operations that must be atomic are not.** Goal contributions, refresh rotation (`H9`), and the three-step password reset (`L3`) all run as sequential unwrapped statements. **`prisma.$transaction` is not used anywhere in the codebase.**

- **No migration history exists.** `prisma migrate status` reports "No migration found in prisma/migrations" and "The current database is not managed by Prisma Migrate" — the schema was applied with `db push`. There is no reproducible path from an empty database to the current schema, no review trail for schema changes, and no way to deploy schema updates safely. For a financial application this is a release blocker in its own right. Baseline the existing schema with `migrate diff` and commit migrations from here on.

- **Decimal precision is correct at rest.** All money columns are `Decimal(12,2)` and rates are `Decimal(10,6)` — the right choice. The problem is entirely in the application layer, where every read converts through `Number()`. No amount has an upper bound in validation, so a value above `9999999999.99` overflows the column and surfaces as a 500.

- **Indexes broadly match the queries.** `@@index([userId, date])` serves the dashboard's date-ranged aggregates and the default transaction sort; `[userId, categoryId]` serves category grouping; `[userId, nextRenewal]` serves renewal ordering. Two gaps: transaction search uses `contains` with `mode: 'insensitive'` on `description` and `merchant` with no supporting index — a sequential scan that will degrade with volume, addressable with a trigram index — and merchant grouping has no index. `I5` `@@index([token])` is redundant beside `@unique`.

- **Constraints are mostly sound but one is subtly weak.** `Category @@unique([name, userId])` does not prevent duplicate system categories, because Postgres treats `NULL` values as distinct in unique indexes — the seed script compensates with an explicit existence check, so the invariant is enforced in application code rather than by the database. Add a partial unique index on `(name) WHERE "userId" IS NULL`.

- **Orphan and integrity risks.** Every user-owned model cascades correctly from `User`, so account deletion is clean. Expired refresh and reset tokens are never purged — both tables grow without bound, and expired reset tokens remain queryable indefinitely. Add a scheduled cleanup. `M12` receipts are never linked to transactions, so the `receiptId` relation is dead and unlinked receipts accumulate with their base64 payloads.

---

## Financial Logic Findings

> Worked through with concrete values and edge cases.

### The core case is correct

Using the stated example — income ₹10,000, expenses ₹3,000 in the current month:

| Metric | Expected | Computed | Source |
|---|---|---|---|
| Balance | 7,000 | **7,000** ✓ | `dashboardService.ts:176` |
| Savings | 7,000 | **7,000** ✓ | `:196` |
| Savings rate | 70.0% | **70.0%** ✓ | `:199` |

Division-by-zero is guarded in every ratio checked: `savingsRate` guards `monthlyIncome > 0`, `percentageUsed` guards `amount > 0`, `progressPercentage` guards `targetAmount > 0`, `dailyAverageExpense` uses `Math.max(1, now.getDate())`, and `totalDays` uses `Math.max(1, …)`. **The arithmetic itself is sound; the problems are in inputs, concurrency and framing.**

### Edge cases

| Case | Behaviour | Assessment |
|---|---|---|
| Zero income, non-zero expenses | `savingsRate` returns 0 | Misleading — a pure-loss month is indistinguishable from break-even. Return null or a negative rate. |
| Zero expenses | All ratios 0, health score benefits | ✓ Correct |
| Previous month zero | `calcChangePercent` returns 100 | Reports "+100%" for growth from nothing. Return null and render "new". |
| Month boundaries | `new Date(y, m+1, 0, 23,59,59,999)` | ✓ Correct, and leap years handled by construction |
| Timezone | Boundaries in server local time; dates stored UTC | Server-local boundaries mean a user in another timezone gets a month window offset by hours. Anchor to the user's timezone. |
| Future-dated transactions | Counted in `totalBalance`, excluded from the trend | Inconsistent — the same transaction is in one figure and not another. No validator bounds the date. |
| Midnight / first / last of month | Inclusive `gte`/`lte` bounds | ✓ Correct |
| Weekly subscription | `amount * 52 / 12` | ✓ Correct — the standard approximation |
| Yearly subscription | `amount / 12` | ✓ Correct |
| Monthly billed after the 28th | Date overflows into the next month | ✗ `M5` drifts and compounds |
| Overdue subscription | `Math.abs` on the difference | ✗ `M6` past dates read as upcoming |

### Structural problems

- **`H8` Mixed currencies are summed as one unit** — the largest correctness risk in the product.
- **`H5` Goal contributions lose concurrent updates** with no ledger to reconstruct from.
- **`H7` `M16` Currency is silently discarded** on transaction and budget creation.
- **`M9` `M10` Budget figures differ between the Dashboard and the Budgets page** — double counting, and mismatched date windows.
- **`M8` Exactly-100% budgets report two contradictory states.**
- **`M21` Goal projections are arbitrary.** Beyond the probability model, `projectedCompletionDate` uses `remainingAmount / (targetAmount * 0.05 + 1)` — a formula that adds a dimensionless 1 to a currency amount purely to avoid dividing by zero. It produces a confident date from an assumption the user never made.
- **Float accumulation.** Aggregates are computed in Postgres as `Decimal` and converted once, which is the right shape and keeps error negligible. The exceptions are `analyticsService`, which accumulates every transaction in JavaScript floats across up to eleven maps, and `L12` the unrounded trend buckets. Neither will produce a visibly wrong total at realistic volumes, but neither should be the pattern in a ledger.
- **No audit trail anywhere.** Amounts are mutable in place with no history: `updateGoal` can set `currentAmount` to any value, bypassing the contribution guards entirely. For financial records, append-only history with derived balances is the defensible model.

---

## Frontend and UI Findings

### Functional

- **`C3`** Session lost on every page reload; logout does not reach the server.
- **`H6`** Dashboard, Budgets and Analytics show stale figures for five minutes after a transaction changes.
- **`M12`** Receipt scanner never links the receipt to the transaction it creates.
- **`L1`** Contribution modal collects a date that is discarded.
- **`L4`** Interceptor's login guard never matches, so failed logins trigger a refresh attempt.
- **`L5`** Object URLs leak in the receipt scanner.
- **`L6`** `formatCurrency` can throw during render, and there is no error boundary to contain it.

### States and structure

- **Loading states are handled well.** `ProtectedRoute` renders a considered skeleton rather than a spinner or a flash of the login page, and mutation buttons consistently disable on `isPending`.
- **Error states are shallow.** The near-universal pattern is `error.response?.data?.message || 'Something went wrong'`. Because `H3` the backend returns 500 for user errors like a malformed id, users will see raw Prisma text in a toast in development and an unhelpful generic in production. There is no distinction between a validation failure, an auth failure and an outage.
- **Validation is duplicated but consistent.** `ResetPassword.tsx` reimplements the backend's five password rules by hand. They currently agree; nothing keeps them agreeing, and `M2` the backend's own three password paths already disagree with each other.
- **Routing.** The catch-all redirects every unmatched path to `/`, so there is no 404 — a mistyped URL silently lands on the dashboard. `/reset-password` correctly reads the token from a query parameter, matching the link the email builds.
- **`retry: 1` applies to authentication failures too** (`App.tsx:26`), so every 401 is issued twice, doubling the requests that trigger a refresh. Disable retries for 4xx.

### Accessibility

- **`L7`** No `role="dialog"`, focus trap, focus restoration or Escape handling in any modal.
- One `aria-label` across 84 buttons — icon-only controls (delete, edit, close) are unlabelled for screen readers.
- 28 `htmlFor` bindings for 40 inputs, so roughly a dozen inputs have no programmatic label.
- Sortable table headers are `<th>` with `onClick` and no `aria-sort`, no `tabindex` and no keyboard handler — they cannot be operated without a mouse.
- Colour alone distinguishes income from expense in several places; the `+`/`−` prefix in `TransactionTable` is the right pattern and should be applied consistently.

### Visual direction

Measured against the stated goal — clean, simple, professional, Airbnb-like — the frontend is closer than the codebase is elsewhere, but it is pulling in two directions. The layout fundamentals are sound: a consistent `max-w-7xl` container, a real spacing rhythm, semantic Tailwind tokens rather than scattered literals, and a coherent light and dark treatment.

What works against it is decorative weight. Border radii run to `rounded-3xl` on content cards, which reads as consumer-app rather than financial-tool. Custom `shadow-premium` tokens are applied broadly rather than to distinguish elevation. Gradient fills appear in the logo, the receipt scanner and the email template. `hover:scale-110` on buttons and `animate-ping` on the scanning state add motion that carries no information. The mobile navigation is a two-column grid of uppercase pills — seven items in a 2×4 block that competes with the page content rather than receding.

The Airbnb reference implies restraint: generous whitespace, a small number of radii, one accent colour used sparingly, shadow reserved for genuine elevation, and motion confined to state transitions. The nearest changes are to settle on two radii, cut gradients to the logo alone, drop the hover scale transforms, and replace the mobile pill grid with a bottom tab bar. Note that the README describes the product as dark-themed while the implementation supports both — worth deciding which is the intent.

---

## API Contract Findings

> Frontend request → Axios service → route → middleware → validator → controller → service → repository → response → frontend parsing. Mismatches found at each layer.

| Layer | Mismatch | Ref |
|---|---|---|
| URL construction | Two `AuthContext` call sites keep the old `/api` prefix and resolve to `/api/api/…` → 404 | `C3` |
| Request fields | `currency` present in the frontend DTO and the service signature, absent from `createTransactionSchema` → silently stripped | `H7` |
| Request fields | `currency` validated on budget create but omitted from the repository call, while update forwards it | `M16` |
| Response types | `Decimal` serialises as a string on transactions and receipts, as a number on dashboard/budget/goal — frontend declares `number` for both | `M15` |
| Status codes | Malformed `:id` → 500 instead of 400/404; oversize upload → 500 instead of 400; unknown `sortBy` → 500 | `H3` `H4` |
| Status codes | Concurrent login → 409 with a database-constraint message on a login form | `C2` |
| Status codes | `forgot-password` returns 200 or 500 depending on whether the account exists | `C5` |
| Error shape | Validation errors add an `errors[]` array; all other errors omit it. No client reads it, so field-level messages are discarded | — |
| Error shape | The 404 handler returns `{error: string}` while every other error returns `{status, statusCode, message}` | — |
| Reachability | `minAmount`/`maxAmount` implemented in the repository, absent from the query validator | `L10` |
| Unused response | Upload returns `receipt.id`; the scanner never uses it, so `receiptId` is always null | `M12` |

**Consistent and correct across the board:** the `{ status, data: { … } }` envelope, resource naming, HTTP verb choice, `201` on create and `200` on update and delete, and the `Authorization: Bearer` scheme. Pagination is uniform — `{ total, page, limit, pages }` — and matches what the client reads. Date fields are ISO 8601 throughout.

---

## Performance Findings

> Actual bottlenecks, not speculative optimisation.

- **`H11` Receipt list responses can reach hundreds of megabytes.** Base64 images in Postgres, returned whole. The single largest performance defect.
- **`H10` Analytics loads the entire transaction history** with hydrated categories, iterates it three times, and blocks on an uncached Gemini call with no timeout.
- **`M17` Budget stats are N+1** — one aggregate query per budget on every load.
- **`M18` Single-subscription reads fetch the whole collection twice.**
- **`M4` The dashboard read path performs writes,** adding N update round trips to a GET.
- **Transaction search has no supporting index.** `contains` with `mode: 'insensitive'` on two columns is a sequential scan; add a trigram index before volume grows.
- **Deep pagination uses offset.** Fine at current scale; keyset pagination becomes necessary past a few thousand rows, and would also resolve `M7`.
- **The dashboard is genuinely well optimised** — eleven queries batched into two `Promise.all` groups, aggregation pushed into SQL via `groupBy`, and a single pass to build trend buckets. It is the model the other services should follow.
- **React rendering is not a bottleneck.** No unnecessary re-render pattern stood out. `refetchOnWindowFocus` is disabled and `staleTime` is generous — which is why `H6` the missing invalidations hurt: the cache is doing exactly what it was configured to do.
- **The frontend bundle is unmeasured.** Recharts and lucide-react are both large, every route is statically imported with no code splitting, and no `React.lazy` appears anywhere. Route-level splitting is the cheap first move.

---

## Code Quality Findings

- **The claimed architecture is real, with one exception.** Eight of nine controllers are thin and delegate to services; services hold the business rules; repositories wrap Prisma. `M19` `userController` ignores all of it and talks to `prisma` directly — and that is precisely where three of the worst findings live.
- **`M20` The repository base class erases Prisma's types,** which is where a `strict` codebase quietly stops being strict.
- **Some services reach past their own repositories.** `dashboardService` and `analyticsService` import `prisma` directly and reimplement queries that already exist as repository methods — `getCategorySpending` is written and then bypassed.
- **Duplicated logic.** `safeDecimal` is defined identically in two services. Category-ownership validation is written three times and omitted a fourth (`M1`). Password complexity rules exist in three backend schemas and once more in the frontend.
- **Naming is inconsistent across parallel modules.** Transaction and budget controllers export `create/findAll/findById/update/remove`; subscriptions use `createSubscription/getSubscriptions/…`; goals mix both. Services vary the same way — `findAll` against `getGoals` against `getSubscriptions`.
- **Comments that no longer match behaviour.** `subscriptionService.ts:102` says the update is persisted "asynchronously in the background" — it is awaited inline. `authController.ts:57` claims a uniform response prevents enumeration — `C5` it does not. `receiptService.ts:44` stores parsed JSON in a column named and documented as `rawText`.
- **`L10` `L11` `L14` Dead code:** six unused repository methods, an unreachable guard, a dead Notification subsystem, two unreachable filters, a committed codemod, a stray root scratch file, an unused import, and three unused dependencies.
- **Error handling is inconsistent by design.** Services throw typed `AppError` subclasses — a good pattern, used consistently. But `authService.logout` swallows every exception into an empty catch with no logging, and the AI service returns success-shaped empties on failure (`M14`). Sixteen `console.*` calls stand in for the declared Winston logger, with no levels, no structure and no request correlation.
- **Genuinely good:** `catchAsync` is applied to every async handler without exception; the Zod-validated env config with a clear failure message and `process.exit(1)` is a pattern worth keeping; the Prisma singleton correctly guards against hot-reload connection exhaustion; and JSDoc coverage on service methods is consistent and accurate where behaviour has not drifted.

---

## Testing Gaps

`npm test` runs seven suites and reports 30 passing assertions on the exact tree where five critical defects were reproduced. `H12` Every suite replaces repository methods with inline stubs, so nothing exercises HTTP, middleware, validators, the error handler, or the database.

| Area | Covered | Reality |
|---|---|---|
| Registration and login | Yes | Against stubbed repositories — the 409 collision in `C2` is invisible to it |
| Refresh rotation | **No** | No test for rotation, reuse, or expiry |
| Password reset | **Not run** | `passwordResetTest.ts` exists but is absent from the `test` script |
| Tenant isolation | Nominally | Asserts a service's reaction to a stub's `userId`; no HTTP request with a second user's token is ever made |
| Authorization middleware | **No** | `authenticateUser` is never executed |
| Validators | **No** | Zod schemas are never exercised — which is why `H7`'s dropped field went unnoticed |
| Error handler | **No** | Never executed; `H3`'s path leak has no test |
| Financial calculations | Partially | Happy paths only — no boundary at exactly 100% (`M8`), no month-end renewal (`M5`), no concurrency (`H5`), no mixed currency (`H8`) |
| Frontend | **None** | No test framework configured in the frontend workspace at all |

The monkey-patching approach has a further hazard: because assignments to the shared singletons are never restored, tests are order-dependent, and only the `&&`-chained separate processes in the `test` script keep them isolated. Any move to a single-process runner would produce confusing cross-suite failures.

### Testing recommendations

Adopt Vitest or Jest with **Supertest against a disposable Postgres instance.** Write four tests first, in this order — each should fail today, and each pins one of the findings above:

1. **Log in twice in the same second** → pins `C2`.
2. **Request every `/:id` route with another user's record** → pins tenant isolation and `M1`.
3. **Change a password via `PUT /users/profile`** → pins `C1`.
4. **Post two concurrent goal contributions** → pins `H5`.

Then build out, in priority order:

- **Auth lifecycle** — login, refresh, rotation, reuse detection, expiry, logout revocation, `logout-all`.
- **Authorization** — every `/:id` route with a foreign id; every route without a token; every route with an expired token.
- **Validators** — malformed UUIDs, unknown `sortBy`, oversize uploads, unsupported MIME types, missing and extra fields (`.strict()` behaviour).
- **Error handler** — assert no filesystem path or source excerpt appears in any response body, in any `NODE_ENV`.
- **Financial edge cases** — the full table in the Financial Logic section, especially the exact-100% budget boundary, month-end subscription renewals, zero-income months, and mixed-currency aggregation.
- **Password reset end-to-end** — request, receive token, redeem, confirm single-use, confirm expiry, confirm sessions revoked, and confirm identical responses for existing and non-existing accounts.
- **Frontend** — add a test framework (none is configured). Start with `AuthContext` session restore and the React Query invalidation contract in `H6`.

Add `passwordResetTest.ts` to the `test` script immediately as a stopgap.

---

## Deployment Findings

- **No deployment configuration exists.** No Dockerfile, no CI workflow, no `render.yaml`, no `vercel.json`, no Procfile. The README names Vercel, Render and Neon as the target stack; none is configured.
- **No migration history.** Covered under Database — there is no reproducible path from an empty database to the current schema, which makes any deployment a manual step.
- **`M3` CORS will reject the deployed frontend or accept everything;** the rate limiter will bucket all users behind the proxy into one IP.
- **`L2` Reset emails link to localhost.**
- **The frontend has no production API URL.** `baseURL: '/api'` relies on the Vite dev proxy, which does not exist in a built bundle. Deployed to Vercel with the API on Render, every request would hit the Vercel origin. There is no `VITE_API_URL` and no `frontend/.env`.
- **Prisma client generation is not wired into the build.** `build` is bare `tsc`; a clean deploy without a prior `prisma generate` fails to compile.
- **No production start path for the frontend** beyond `vite preview`, which is explicitly not a production server.
- **No health-check depth.** `/health` returns a static object without touching the database, so it reports healthy during a total database outage — exactly when a load balancer most needs to know.
- **Environment handling is the strongest part.** The Zod-validated schema with explicit per-variable messages and `process.exit(1)` on failure is genuinely good practice. Two gaps: `SMTP_*` is optional even in production, which is how `C5` ships silently; and the error handler reads `process.env.NODE_ENV` directly rather than the validated `env` object, so a typo'd value fails open and leaks stack detail.
- **Secrets are handled correctly** — `.env` is gitignored, `.env.example` carries only placeholders, and nothing sensitive is committed.

---

## Documentation Mismatches

| Claim | Reality | Where |
|---|---|---|
| "Winston logs manager" | Declared but never imported; 16 raw `console.*` calls | README, Backend stack |
| "CORS filters" | `cors()` with no options — reflects every origin | README, Backend stack |
| "Deployment: Vercel / Render / Neon" | No deployment configuration of any kind exists | README, Infrastructure |
| "amount constraints" in the transaction manager | `minAmount`/`maxAmount` unreachable over HTTP | README, Feature 3 |
| "Receipt Scanner … matches transactions" | Receipts are never linked to transactions | README, Feature 7 |
| Dark-themed interface | Both themes are implemented and supported | README, opening |
| Refresh-token rotation described as a security control | Rotation happens, but reuse is undetected and tokens are stored in plaintext | PROJECT_KNOWLEDGE, auth flow |
| Interceptor "replays all queued requests … without a forced reload" | Accurate for the queue, but `C3` forces a logout and a hard redirect on every reload | PROJECT_KNOWLEDGE, Q&A |

### Undocumented endpoints

PROJECT_KNOWLEDGE.md is 965 lines and documents auth, transactions, categories, budgets, goals, receipts, subscriptions and dashboard in real detail — request bodies, response shapes, status codes. It is a genuine asset. **Eight implemented endpoints are missing from it entirely:**

| Endpoint | Note |
|---|---|
| `POST /api/auth/forgot-password` | Newest feature, zero documentation |
| `POST /api/auth/reset-password` | Newest feature, zero documentation |
| `PUT /api/users/profile` | Carries the `C1` vulnerability |
| `POST /api/users/change-password` | — |
| `POST /api/users/logout-all` | — |
| `GET /api/users/export` | Omits receipts and notifications despite being a full-export endpoint |
| `DELETE /api/users/account` | Irreversible; carries the `H1` vulnerability |
| `GET /api/analytics` | The most expensive endpoint in the application |

The pattern is worth noting on its own: **the undocumented endpoints are disproportionately the dangerous ones.** Everything routed through the documented service layer is comparatively sound; the entire `/api/users` surface skipped the service layer, skipped the documentation, and skipped the tests — and it is where the account-takeover and account-destruction findings both live.

### Accurate documentation worth preserving

Documented request and response shapes match the implementation where they exist, including the subtle detail that transaction `amount` serialises as a string (`"250.5"`). Rate-limit annotations, status codes and the auth sequence diagrams are all correct. The most recent commit message — removing the `/api` prefix and configuring the Vite proxy — accurately describes what it did, apart from the two call sites it missed.

---

## Project Readiness Score

> Scored against what a production financial application requires, not against typical project work at this stage.

| Dimension | Score |
|---|---|
| Functionality | **5** / 10 |
| Security | **2** / 10 |
| Database | **5** / 10 |
| Financial correctness | **4** / 10 |
| Backend architecture | **7** / 10 |
| Frontend quality | **6** / 10 |
| Testing | **2** / 10 |
| Performance | **4** / 10 |
| Production readiness | **2** / 10 |
| **Overall** | **3.8** / 10 |

### Reading the scores

**Backend architecture (7)** is the highest mark and deserves it. The layering is real, the error classes are well designed, `catchAsync` is applied without exception, and the dashboard service shows genuine skill in query batching. The deductions are `userController` bypassing every layer, the untyped repository base, and services reaching past their own repositories.

**Security (2)** is not a comment on effort — anti-enumeration, token rotation, bcrypt, Helmet, rate limiting and tenant scoping are all present, and the tenant scoping in particular is thorough and consistent. The score reflects that a single endpoint hands over any account to anyone holding a 15-minute token, and that this is reachable today.

**Financial correctness (4)** reflects arithmetic that is right and inputs that are not. The worked example produces exactly the right numbers. Mixed currencies, lost concurrent contributions, silently dropped currency fields and two screens that disagree about the same budget are what pull it down.

**Testing (2) and production readiness (2)** are the two that most limit everything else. Without a test that can fail, none of these fixes stays fixed; without migrations, a production API URL and a deployment configuration, there is no path to production regardless of code quality.

**The encouraging read:** most of these are shallow. Four of the five critical findings are a few lines each — delete a schema field, change a token generator, fix two URLs, wrap a call in try/catch. The deeper work is currency, the audit trail, and the test suite. This is a codebase with good bones and a security review it has not yet had.

---

**SpendSense Production Audit** · HEAD `e19794b` · 2026-08-13 · Read-only review, no source files modified.

58 findings across 122 source files. Five reproduced against the running application; the remainder traced through source.

All secrets redacted. No destructive command was executed and no database state was altered beyond one throwaway test account.
