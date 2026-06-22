# Remove Auth — retire Clerk login / gating

**Goal:** Remove all user-facing authentication from the Readiness Console. The page and `GET /api/readiness` become publicly accessible. The dashboard currently exposes no private or sensitive information, so the invite-only Clerk gate added in Phase 3 is unnecessary overhead.

**Scope of this doc:** Removal only. It reverses the Phase 3 auth layer (`2026-06-18-phase3-auth-design.md`). It does **not** change the `ReadinessPayload` shape, the rollup/composite logic, or the cron pipeline.

**Why now:** The console only shows internal delivery-readiness status rolled up from Monday boards — no PII, no financials, nothing that warrants a named-login gate. The auth layer adds operational cost (Clerk account, env vars, invite management, a 401 failure mode) with no protected asset behind it. Removing it simplifies the deployment and unblocks sharing the link freely.

---

## 1. Decisions (settled in brainstorming)

- **Remove the entire Clerk auth layer** — client gate, token-verified endpoint, SDKs, and env vars.
- **Keep `CRON_SECRET`** on `POST /api/refresh`. That guards a write/mutation endpoint (Monday → Blob) and is unrelated to user login. Untouched.
- **`/api/readiness` becomes public** — no token check, returns the payload to anyone. `Cache-Control` changes from `private, no-store` to `public, no-store` (still uncached, but no longer per-user).
- **Historical Phase 3 docs are preserved** as an accurate record of what was built. This removal is recorded in a new spec (this doc) plus an SDD-ledger entry — not by deleting the Phase 3 spec/plan.
- **Vercel env cleanup** — the three Clerk env vars are removed from the Vercel project (Preview + Production) via `vercel env rm`, confirmed one at a time, as a deploy task.

**Explicitly out of scope (YAGNI):** any replacement auth, rate limiting, or obscurity measure. Re-introduce authentication later (re-applying Phase 3) only if the dashboard starts handling private data.

---

## 2. Architecture (after removal)

```
  Anyone ──────────────► SPA (Vite + React)  — no ClerkProvider, no AuthGate
                         renders <App/> directly
                                  │ fetch('/api/readiness')   (no Authorization header)
                                  ▼
                         GET /api/readiness  — public; read Blob → baseline
                         (no verifyRequest, no 401)

  Vercel Cron ─(CRON_SECRET)─► POST /api/refresh  (UNCHANGED) ─► Monday ─► write Blob
```

| Surface | Before | After |
|---|---|---|
| Page (SPA) | Clerk client gate | Public — renders directly |
| `GET /api/readiness` | Clerk token → 401 without it | Public — always serves the payload |
| `POST /api/refresh` (cron) | `CRON_SECRET` | **Unchanged** — `CRON_SECRET` |
| Data Blob | read server-side | **Unchanged** |

---

## 3. Files

### Delete
- `src/components/AuthGate.tsx`
- `src/components/AuthGate.test.tsx`
- `api/_lib/auth.ts`
- `api/_lib/auth.test.ts`

### Modify
- `src/main.tsx` — drop `<ClerkProvider>` and `<AuthGate>`; render `<App/>` directly inside `<StrictMode>`.
- `src/App.tsx` — remove `useAuth`/`getToken`; call `fetchReadiness(ctrl.signal)` with no token. Drop the `getToken` dependency from the effect.
- `src/api.ts` — `fetchReadiness(signal?)`: drop the `getToken` parameter and the `Authorization` header; plain `fetch('/api/readiness', { signal })`.
- `src/api.test.ts` — drop the token-getter / `Authorization`-header assertions; assert the plain fetch.
- `src/App.test.tsx` — remove the `@clerk/clerk-react` mock and the `mockGetToken`.
- `src/vite-env.d.ts` — remove `VITE_CLERK_PUBLISHABLE_KEY` from `ImportMetaEnv` (leave the `vite/client` reference).
- `api/readiness.ts` — remove the `verifyRequest` import and the 401 check; set `Cache-Control: public, no-store`; serve `readLatest() ?? buildPayload(...)`.
- `api/readiness.test.ts` — remove the no-token-→-401 and valid-token cases and the `auth` mock; assert it returns 200 with the payload unconditionally.
- `package.json` — remove `@clerk/backend` and `@clerk/clerk-react`; update lockfile via install.
- `.env.example` — remove `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`. Keep `CRON_SECRET`, Monday, and Blob vars.
- `docs/superpowers/reports/sdd-progress-ledger.md` — add an entry recording the auth retirement.

### Unchanged (verify still green)
- `api/refresh.ts`, `api/_lib/config.ts` (`getCronSecret`), `api/import-extensions.test.ts` (will no longer scan the deleted `auth.ts`).

---

## 4. Testing (TDD: red → green → refactor)

Removal is test-first too: update each test to the post-removal expectation, watch it fail against the old code, then change the code to green.

- `src/api.test.ts` — `fetchReadiness(signal)` issues `fetch('/api/readiness', { signal })` with **no** `Authorization` header.
- `api/readiness.test.ts` — handler returns `200` with the payload and `Cache-Control: public, no-store`; no auth path remains.
- `src/App.test.tsx` — renders without any Clerk mock; `fetchReadiness` is called with just the signal.
- Delete `api/_lib/auth.test.ts` and `src/components/AuthGate.test.tsx` (their subjects are gone).
- `api/import-extensions.test.ts` — stays green (no longer scans `auth.ts`).
- Full suite green (`npx vitest run`); `npm run build` green.

---

## 5. Deploy prerequisites & handoff

- **Remove Vercel env vars** (Preview + Production), confirmed one at a time: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_AUTHORIZED_PARTIES`.
- **Clerk application** — the Clerk app/org itself can be deactivated/deleted by the owner once this ships; not a code task. Note it in handoff.
- **Live verification after deploy:** anonymous load renders the dashboard directly (no sign-in screen); `GET /api/readiness` returns `200` without any token; the cron `/api/refresh` still requires `CRON_SECRET` (unchanged).
- Per project git-flow: `feature → develop` implicit on green; `develop → main` and the production promotion need explicit user OK.

---

## 6. Open items

- None blocking. The Clerk account teardown is a post-merge housekeeping step for the account owner.
