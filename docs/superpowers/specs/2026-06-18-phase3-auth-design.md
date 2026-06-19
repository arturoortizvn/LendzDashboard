# Phase 3 — Access Control (Clerk, invite-only, email magic-link)

**Goal:** Gate the Readiness Console — both the page and `GET /api/readiness` — so only an invited allowlist of `@viewnear.com` / `@lendzfinancial.com` users can see the live internal delivery data. Free, fits the team, named logins.

**Scope of this doc:** Phase 3 only. The Bank Analyzer metrics-DB wiring (Phase 2b) is out of scope. This adds an auth layer; it does **not** change the `ReadinessPayload` shape or any rollup/composite logic.

**Why now:** Phase 2a shipped live Monday numbers to a public production domain (`lendz-dashboard.vercel.app`) behind only an unguessable URL + `noindex`. Native Vercel production-domain protection needs a paid add-on (not on the current Pro plan), so a code-level gate is the real, free lock. The team accepted the interim public window to fast-track this phase.

---

## 1. Decisions (settled in brainstorming)

- **Provider:** Clerk. Native Vercel Marketplace integration, first-class React SPA SDK (`@clerk/clerk-react`) that fits our Vite app, generous free tier.
- **Access policy:** **invite-only allowlist** (public sign-up disabled). Permitted email domains: **`@viewnear.com`** and **`@lendzfinancial.com`**. Only explicitly invited addresses on those domains can complete sign-in.
- **Login method:** email **magic-link** (IdP-agnostic — works regardless of whether the company is on Google Workspace or Microsoft 365). Login method is a Clerk toggle, so Google/Microsoft SSO can be enabled later without code changes.
- **Gating approach:** **A — client-side gate + token-verified endpoint.** The SPA renders a sign-in screen until authenticated; `/api/readiness` independently verifies the Clerk session token server-side. The static shell (UI chrome, no data) remains publicly downloadable — acceptable because all sensitive data sits behind the token-checked endpoint.
- **Blob privacy:** migrate the last-known-good Blob to private (defense in depth). **Lowest-priority task** — deferrable to a fast-follow if the private read path adds risk, since the Blob URL is never exposed to the client today.

**Explicitly out of scope (YAGNI):** edge-middleware gate (approach B, future if the shell must also be hidden); roles/permissions (single access level — in or out); Google/Microsoft SSO (later toggle).

---

## 2. Architecture

```
                         ┌─────────────────────────────────────┐
  Anonymous ───────────► │  SPA (Vite + React)                 │
                         │  <ClerkProvider> + <AuthGate>       │
                         │   SignedOut → <SignIn> (magic-link) │
                         │   SignedIn  → dashboard             │
                         └──────────────┬──────────────────────┘
                                        │ fetch w/ Authorization: Bearer <clerk token>
                                        ▼
                         ┌─────────────────────────────────────┐
  Clerk (identity) ◄────►│  GET /api/readiness                 │
  invite allowlist       │   verifyRequest() → 401 | claims    │
  magic-link             │   then: read Blob → baseline        │
                         └─────────────────────────────────────┘

  Vercel Cron ─(CRON_SECRET)─► POST /api/refresh  (UNCHANGED) ─► Monday ─► write Blob (private)
```

| Surface | Protection |
|---|---|
| Page (SPA) | Client gate via `@clerk/clerk-react` |
| `GET /api/readiness` | Server-side Clerk token verification (`@clerk/backend`) → 401 without a valid token |
| `POST /api/refresh` (cron) | **Unchanged** — `CRON_SECRET` |
| Data Blob | Private (read via SDK with token); closes the public-URL vector |

---

## 3. Environment variables & security

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk **publishable** key. **Not a secret**: designed to live in the client bundle. The `VITE_` prefix is correct here and does **not** violate the no-secrets-in-`VITE_*` rule.
- `CLERK_SECRET_KEY` — **server-only**, no `VITE_` prefix. Used only by the function to verify tokens. Never committed; set as a Sensitive env var in Vercel (Preview + Production).
- Existing `CRON_SECRET`, `MONDAY_API_TOKEN`, `MONDAY_MODULE_COLUMN_ID`, `ID_MONDAY`, `BLOB_READ_WRITE_TOKEN` unchanged.
- `.env.example` gains the two Clerk var **names** (blank values).

---

## 4. Components & file structure

```
src/
  main.tsx                  # MODIFY: wrap <App/> in <ClerkProvider publishableKey={…}>
  App.tsx                   # MODIFY: get token via useAuth().getToken(); pass to fetchReadiness
  api.ts                    # MODIFY: fetchReadiness(getToken) attaches Authorization: Bearer
  components/
    AuthGate.tsx            # CREATE: <SignedOut> → sign-in screen; <SignedIn> → children
    AuthGate.test.tsx       # CREATE
api/
  readiness.ts              # MODIFY: verifyRequest() first → 401, else existing behavior
  readiness.test.ts         # MODIFY: add no-token → 401 and valid-token → 200 cases
  _lib/
    auth.ts                 # CREATE: verifyRequest(req) → claims|null; getClerkSecret()
    auth.test.ts            # CREATE
    blob.ts                 # MODIFY (lowest priority): private store + tokenized read
.env.example                # MODIFY: add VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY (names only)
package.json                # MODIFY: add @clerk/clerk-react, @clerk/backend
```

### 4.1 `api/_lib/auth.ts`
- `getClerkSecret(): string` — reads `CLERK_SECRET_KEY`, throws a descriptive error if unset (mirrors the env-reader pattern in `config.ts`).
- `verifyRequest(req): Promise<Claims | null>` — extract the `Authorization: Bearer <token>` header; `verifyToken(token, { secretKey: getClerkSecret() })` from `@clerk/backend`; return the verified claims, or `null` on missing/invalid token. Catches verification errors and returns `null` (never throws on a bad token).
- ESM: all relative imports carry `.js` (enforced by `api/import-extensions.test.ts`).

### 4.2 `api/readiness.ts`
```
export default async function handler(req, res) {
  const claims = await verifyRequest(req)
  if (!claims) return res.status(401).json({ error: 'unauthorized' })
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
  const latest = await readLatest()
  res.status(200).json(latest ?? buildPayload(new Date().toISOString()))
}
```

### 4.3 Frontend
- `main.tsx`: `<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>` around the app.
- `AuthGate.tsx`: `<SignedOut>` renders a branded sign-in screen (`<SignIn/>` configured for magic-link); `<SignedIn>` renders the dashboard children.
- `api.ts`: `fetchReadiness(getToken)` calls `await getToken()` and sends `Authorization: Bearer <token>`. On 401 it surfaces an "auth expired" error the UI can show.
- `App.tsx`: uses `useAuth()` to obtain `getToken`, passes it into the fetch; keeps the existing loading/error states.

---

## 5. Data flow

1. Anonymous user loads the SPA → Clerk finds no session → magic-link sign-in screen.
2. User enters their `@viewnear.com` / `@lendzfinancial.com` email → if invited, receives the magic link → clicks → session cookie established.
3. Authenticated → `getToken()` → `fetch('/api/readiness', { Authorization: Bearer … })` → function verifies → `200` payload → render.
4. Cron every 15 min → `/api/refresh` (`CRON_SECRET`) → Monday rollup → writes the Blob (private). Unchanged except the Blob `access`.

---

## 6. Error handling

- Missing/invalid token at `/api/readiness` → `401 { error: 'unauthorized' }`; `readLatest` is never called.
- SPA receives 401 → "session expired, sign in again" → Clerk re-auth.
- Email not on the allowlist → Clerk blocks the sign-in with its own message (configured in the dashboard).
- `CLERK_SECRET_KEY` unset → `getClerkSecret()` throws a descriptive error → 500 (same posture as `config.ts` env readers).
- `VITE_CLERK_PUBLISHABLE_KEY` unset at build → `<ClerkProvider>` fails visibly (not a silent broken page).
- Blob missing → baseline fallback (unchanged), now behind auth.

---

## 7. Testing (TDD: red → green → refactor)

- `api/_lib/auth.test.ts` — mock `@clerk/backend`: valid token → claims; missing header → `null`; invalid token (verifyToken throws) → `null`.
- `api/readiness.test.ts` (extend) — no token → `401`, `readLatest` not called; valid token → `200` with 7 modules (mock `auth` + `blob`).
- `api/import-extensions.test.ts` — already scans the new `_lib/auth.ts`; relative imports must end in `.js`.
- `src/components/AuthGate.test.tsx` — mock `@clerk/clerk-react`: SignedOut → sign-in rendered; SignedIn → children rendered.
- `src/api.test.ts` (extend) — `fetchReadiness` attaches the `Authorization` header from the token getter.
- Full suite stays green (`npx vitest run`); `npm run build` green.

---

## 8. Deploy prerequisites & handoff (manual — gated on external inputs)

Like Phase 2a's deploy task, these gate going live, not writing the code:

- **Confirm the Clerk account/org** to use (work-project rule — do not provision remotely without explicit OK). Could be Arturo's or a Viewnear-owned Clerk account.
- **Create the Clerk application**; configure: disable public sign-up; Restrictions/allowlist limited to the two permitted domains; enable Email magic-link.
- **Collect the invite list** (e.g. Alessandra, PJ, Juan, the dev team) and invite them.
- **Set Vercel env** (Preview + Production): `CLERK_SECRET_KEY` (Sensitive), `VITE_CLERK_PUBLISHABLE_KEY`.
- **Live verification:** anonymous → sign-in screen; an allowlisted email gets in; `/api/readiness` returns `401` without a token and `200` with a valid token; a non-invited email is rejected.
- Per project git-flow: `feature → develop` implicit on green; `develop → main` and the production promotion need explicit user OK.

---

## 9. Open items to confirm

- **Clerk account ownership** (blocks provisioning, not coding).
- **The invite list** (the actual people/emails).
- **Blob privacy** included as the lowest-priority task; confirm keep-vs-defer if the private read path proves fiddly.
