# Remove Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Clerk authentication layer so the Readiness Console and `GET /api/readiness` are publicly accessible, keeping the `CRON_SECRET` guard on the cron.

**Architecture:** Reverse the Phase 3 auth wiring. Strip the client gate (`ClerkProvider`/`AuthGate`), the server token check (`verifyRequest` in `/api/readiness`), the Clerk SDKs, and the Clerk env vars. The data path (Monday → Blob → `buildPayload`) and the `CRON_SECRET`-guarded `/api/refresh` are untouched.

**Tech Stack:** Vite + React 19 (SPA), Vercel serverless functions (`@vercel/node`), Vitest + Testing Library, TypeScript (`tsc -b`).

## Global Constraints

- Work on branch `feature/remove-auth` only — never commit to `develop` or `main`.
- ESM: every relative import under `api/` ends in `.js` (enforced by `api/import-extensions.test.ts`).
- Keep `CRON_SECRET` and `api/refresh.ts` / `getCronSecret()` exactly as they are — out of scope.
- No secrets in `VITE_*` vars (general rule; the removed `VITE_CLERK_PUBLISHABLE_KEY` was a public publishable key).
- Code, identifiers, comments, and commit messages in English. No new comments unless they explain a non-obvious *why*.
- Each task ends green on both `npx vitest run` and `npm run build`.
- Commit messages end with: `Claude-Session: https://claude.ai/code/session_01W6yQf3PHLitmkhRyPWFsV1`

---

### Task 1: Make `GET /api/readiness` public and remove server-side auth

**Files:**
- Modify: `api/readiness.ts`
- Test: `api/readiness.test.ts`
- Delete: `api/_lib/auth.ts`, `api/_lib/auth.test.ts`

**Interfaces:**
- Consumes: `readLatest()` from `./_lib/blob.js`, `buildPayload(asOf)` from `../shared/readiness.js` (both unchanged).
- Produces: `handler(req, res)` that always serves the payload with `200` and `Cache-Control: public, no-store`. No `verifyRequest` export remains anywhere.

- [ ] **Step 1: Rewrite the test file to the post-removal expectation**

Replace the entire contents of `api/readiness.test.ts` with:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

vi.mock('./_lib/blob.js', () => ({ readLatest: vi.fn() }))

import handler from './readiness'
import { buildPayload } from '../shared/readiness'
import { readLatest } from './_lib/blob.js'

function mockRes() {
  const res: Partial<VercelResponse> & { body?: unknown; statusCode?: number; headers: Record<string, string> } = {
    headers: {},
    setHeader(k: string, v: string) { this.headers[k] = v; return this as VercelResponse },
    status(code: number) { this.statusCode = code; return this as VercelResponse },
    json(payload: unknown) { this.body = payload; return this as VercelResponse },
  }
  return res
}

afterEach(() => vi.clearAllMocks())

test('serves the last-known-good payload publicly, no shared cache', async () => {
  const live = { ...buildPayload('2026-06-18T00:00:00Z'), source: 'live' as const, builtAt: '2026-06-18T00:00:00Z' }
  vi.mocked(readLatest).mockResolvedValue(live)
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source: string; builtAt: string }
  expect(body.source).toBe('live')
  expect(body.modules).toHaveLength(7)
  expect(body.builtAt).toBe('2026-06-18T00:00:00Z')
  expect(readLatest).toHaveBeenCalledTimes(1)
  expect(res.headers['Cache-Control']).toContain('public')
  expect(res.headers['Cache-Control']).toContain('no-store')
})

test('falls back to the config baseline when the blob is missing', async () => {
  vi.mocked(readLatest).mockResolvedValue(null)
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source?: string }
  expect(body.modules).toHaveLength(7)
  expect(body.source).toBe('baseline')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/readiness.test.ts`
Expected: FAIL — the current handler still calls the real `verifyRequest` (no header → `null` → `401`), so the first test fails expecting `200`.

- [ ] **Step 3: Rewrite the handler to serve publicly**

Replace the entire contents of `api/readiness.ts` with:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPayload } from '../shared/readiness.js'
import { readLatest } from './_lib/blob.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, no-store')
  const latest = await readLatest()
  res.status(200).json(latest ?? buildPayload(new Date().toISOString()))
}
```

- [ ] **Step 4: Delete the now-unused auth module and its test**

Run: `git rm api/_lib/auth.ts api/_lib/auth.test.ts`
Expected: both files removed; nothing imports `./_lib/auth.js` anymore (`api/readiness.ts` was its only importer).

- [ ] **Step 5: Run the full suite and the typecheck**

Run: `npx vitest run && npm run build`
Expected: PASS — `api/readiness.test.ts` green; `api/import-extensions.test.ts` green (no longer scans the deleted `auth.ts`); `tsc -b` clean (`@clerk/backend` is still installed, just unused).

- [ ] **Step 6: Commit**

```bash
git add api/readiness.ts api/readiness.test.ts
git commit -m "Make GET /api/readiness public; remove server-side Clerk auth

The dashboard has no private data, so the endpoint no longer verifies a
Clerk token or returns 401. Cache-Control becomes public, no-store. The
auth helper and its test are deleted; CRON_SECRET on /api/refresh is
untouched.

Claude-Session: https://claude.ai/code/session_01W6yQf3PHLitmkhRyPWFsV1"
```

---

### Task 2: Drop the token from the frontend data fetch

**Files:**
- Modify: `src/api.ts`, `src/App.tsx`
- Test: `src/api.test.ts`, `src/App.test.tsx`

**Interfaces:**
- Consumes: `ReadinessPayload` type from `../shared/readiness` (unchanged).
- Produces: `fetchReadiness(signal?: AbortSignal): Promise<ReadinessPayload>` — no token parameter, no `Authorization` header. `App` calls `fetchReadiness(ctrl.signal)` and no longer imports `@clerk/clerk-react`.

- [ ] **Step 1: Rewrite `src/api.test.ts` to the no-token expectation**

Replace the entire contents of `src/api.test.ts` with:

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { fetchReadiness } from './api'

afterEach(() => vi.unstubAllGlobals())

test('fetches and returns the parsed payload without an Authorization header', async () => {
  const payload = { asOf: 'x', modules: [] }
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) })
  vi.stubGlobal('fetch', fetchSpy)
  await expect(fetchReadiness()).resolves.toEqual(payload)
  expect(fetchSpy).toHaveBeenCalledWith(
    '/api/readiness',
    expect.not.objectContaining({ headers: expect.objectContaining({ Authorization: expect.anything() }) }),
  )
})

test('throws on a non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
  await expect(fetchReadiness()).rejects.toThrow(/500/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/api.test.ts`
Expected: FAIL — `fetchReadiness` currently requires a `getToken` argument and always sends `headers`, so the calls and the no-header assertion fail.

- [ ] **Step 3: Rewrite `src/api.ts` to drop the token**

Replace the entire contents of `src/api.ts` with:

```ts
import type { ReadinessPayload } from '../shared/readiness'

export async function fetchReadiness(signal?: AbortSignal): Promise<ReadinessPayload> {
  const res = await fetch('/api/readiness', { signal })
  if (!res.ok) {
    throw new Error(`Failed to load readiness data (${res.status})`)
  }
  return (await res.json()) as ReadinessPayload
}
```

- [ ] **Step 4: Update `src/App.tsx` to call the new signature**

In `src/App.tsx`:
- Delete the import line `import { useAuth } from '@clerk/clerk-react'`.
- Delete the line `const { getToken } = useAuth()`.
- Change `fetchReadiness(getToken, ctrl.signal)` to `fetchReadiness(ctrl.signal)`.
- Change the effect dependency array from `[getToken]` to `[]`.

The effect block becomes:

```tsx
  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadiness(ctrl.signal)
      .then((p) => {
        setPayload(p)
        setActiveKey(p.modules[0]?.key ?? null)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => ctrl.abort()
  }, [])
```

- [ ] **Step 5: Update `src/App.test.tsx` to drop the Clerk mock**

In `src/App.test.tsx`, delete these lines:

```tsx
const mockGetToken = vi.fn().mockResolvedValue('tok')
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken }),
}))
```

Leave the rest of the file (the `./api` mock and both `test(...)` blocks) unchanged.

- [ ] **Step 6: Run the suite and the typecheck**

Run: `npx vitest run src/api.test.ts src/App.test.tsx && npm run build`
Expected: PASS — both files green; `tsc -b` clean (`App.tsx` and `api.ts` no longer reference `@clerk/clerk-react`; `AuthGate.tsx` and `main.tsx` still do, so the package stays installed).

- [ ] **Step 7: Commit**

```bash
git add src/api.ts src/api.test.ts src/App.tsx src/App.test.tsx
git commit -m "Fetch /api/readiness without a Clerk token in the SPA

fetchReadiness drops the getToken parameter and the Authorization header;
App no longer uses useAuth. Tests updated to assert the plain fetch.

Claude-Session: https://claude.ai/code/session_01W6yQf3PHLitmkhRyPWFsV1"
```

---

### Task 3: Remove the client auth gate (app shell)

**Files:**
- Modify: `src/main.tsx`, `src/vite-env.d.ts`
- Delete: `src/components/AuthGate.tsx`, `src/components/AuthGate.test.tsx`

**Interfaces:**
- Consumes: `App` from `./App` (unchanged).
- Produces: an app shell that renders `<App/>` directly inside `<StrictMode>`. No file in `src/` imports `@clerk/clerk-react` after this task.

- [ ] **Step 1: Rewrite `src/main.tsx` to render the app directly**

Replace the entire contents of `src/main.tsx` with:

```tsx
import './styles/app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 2: Delete the AuthGate component and its test**

Run: `git rm src/components/AuthGate.tsx src/components/AuthGate.test.tsx`
Expected: both files removed.

- [ ] **Step 3: Remove the Clerk env var from the Vite type declarations**

Replace the entire contents of `src/vite-env.d.ts` with:

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Verify no Clerk references remain in `src/`**

Run: `grep -rin clerk src/`
Expected: no output (exit code 1).

- [ ] **Step 5: Run the full suite and the typecheck**

Run: `npx vitest run && npm run build`
Expected: PASS — full suite green; the deleted `AuthGate.test.tsx` is gone; `tsc -b` clean. Both `@clerk/*` packages are now unused.

- [ ] **Step 6: Commit**

```bash
git add src/main.tsx src/vite-env.d.ts
git commit -m "Remove the Clerk client gate from the app shell

main.tsx renders App directly without ClerkProvider/AuthGate; the
AuthGate component, its test, and the VITE_CLERK_PUBLISHABLE_KEY type
are deleted.

Claude-Session: https://claude.ai/code/session_01W6yQf3PHLitmkhRyPWFsV1"
```

---

### Task 4: Remove Clerk dependencies and environment variables

**Files:**
- Modify: `package.json`, `package-lock.json` (via install), `.env.example`

**Interfaces:**
- Consumes: nothing — by this point no source file imports `@clerk/backend` or `@clerk/clerk-react`.
- Produces: a dependency tree and `.env.example` with no Clerk references; `CRON_SECRET`, Monday, and Blob vars retained.

- [ ] **Step 1: Remove the Clerk packages**

Run: `npm remove @clerk/backend @clerk/clerk-react`
Expected: both removed from `package.json` `dependencies` and `package-lock.json` updated.

- [ ] **Step 2: Remove the Clerk vars from `.env.example`**

Delete these three blocks from `.env.example` (the comment line and its var line for each):

```
# Clerk publishable key (PUBLIC by design — safe in the client bundle)
VITE_CLERK_PUBLISHABLE_KEY=
# Clerk secret key (server-side only — never VITE_*, used to verify session tokens)
CLERK_SECRET_KEY=
# Clerk authorized parties: comma-separated origin allowlist for the token `azp` claim.
# Empty disables the check; the deployment's own Vercel origins are always allowed (server-side only).
CLERK_AUTHORIZED_PARTIES=
```

Keep all other entries (Monday, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`).

- [ ] **Step 3: Confirm Clerk is fully gone from the repo**

Run: `grep -rin clerk src api shared .env.example package.json`
Expected: no output (exit code 1).

- [ ] **Step 4: Run the full suite and the typecheck**

Run: `npx vitest run && npm run build`
Expected: PASS — full suite green; `tsc -b` clean with the Clerk packages uninstalled.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Drop @clerk/* dependencies and Clerk env vars

No source references Clerk anymore. Removes @clerk/backend and
@clerk/clerk-react and the three Clerk entries from .env.example;
CRON_SECRET, Monday, and Blob vars stay.

Claude-Session: https://claude.ai/code/session_01W6yQf3PHLitmkhRyPWFsV1"
```

---

### Task 5: Record the auth retirement in the SDD ledger

**Files:**
- Modify: `docs/superpowers/reports/sdd-progress-ledger.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Read the ledger to match its existing entry format**

Run: `sed -n '1,40p' docs/superpowers/reports/sdd-progress-ledger.md`
Expected: see the heading style and the most recent entries so the new entry matches.

- [ ] **Step 2: Add an entry recording the removal**

Append (or insert at the top of the entries, matching the file's existing ordering) an entry that records: Phase 3 auth retired on 2026-06-22; reason — the dashboard exposes no private data; the client gate, the `/api/readiness` token check, the `@clerk/*` deps, and the Clerk env vars were removed; `CRON_SECRET` on `/api/refresh` kept; Phase 3 spec/plan preserved as history; spec `docs/superpowers/specs/2026-06-22-remove-auth-design.md`; follow-up — owner deactivates the Clerk app and removes the three Vercel env vars.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/reports/sdd-progress-ledger.md
git commit -m "Record Clerk auth retirement in the SDD ledger

Claude-Session: https://claude.ai/code/session_01W6yQf3PHLitmkhRyPWFsV1"
```

---

## Post-implementation (manual / gated — not part of the TDD tasks)

These are deploy/handoff steps, performed after the code tasks and confirmed with the user:

- Remove the three Vercel env vars (Preview + Production), one at a time:
  `vercel env rm VITE_CLERK_PUBLISHABLE_KEY`, `vercel env rm CLERK_SECRET_KEY`, `vercel env rm CLERK_AUTHORIZED_PARTIES`.
- Live verification after deploy: anonymous load renders the dashboard directly (no sign-in); `GET /api/readiness` returns `200` with no token; `/api/refresh` still needs `CRON_SECRET`.
- Per git-flow: `feature → develop` implicit on green; `develop → main` and the production promotion need explicit user OK.
- Housekeeping: the Clerk account owner deactivates/deletes the Clerk application.

---

## Self-Review

**Spec coverage:**
- Delete `AuthGate.tsx`/test, `auth.ts`/test → Tasks 3 and 1. ✓
- Modify `main.tsx`, `App.tsx`, `api.ts`, `readiness.ts`, `vite-env.d.ts` + their tests → Tasks 1–3. ✓
- Remove `@clerk/*` deps + 3 env vars, keep `CRON_SECRET`/Monday/Blob → Task 4. ✓
- `Cache-Control` `private, no-store` → `public, no-store` → Task 1. ✓
- Preserve Phase 3 docs; add ledger entry → Task 5 (no Phase 3 doc deleted anywhere). ✓
- Vercel env cleanup + live verification → Post-implementation section. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full file contents or exact line edits. Task 5 is doc-only and intentionally describes the entry content rather than dictating prose. ✓

**Type consistency:** `fetchReadiness(signal?: AbortSignal)` is defined in Task 2 Step 3 and called as `fetchReadiness(ctrl.signal)` (App) and `fetchReadiness()` (test) — consistent. `handler(_req, res)` signature consistent across Task 1. No references to `verifyRequest`/`getToken`/`useAuth` survive after their removing task. ✓
