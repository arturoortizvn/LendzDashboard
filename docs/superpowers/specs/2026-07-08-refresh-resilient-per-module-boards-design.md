# Resilient per-module boards: repoint delivery/tax, hide boardless modules

**Date:** 2026-07-08
**Status:** Approved (design)
**Branch:** `fix/refresh-resilient-per-module-boards`

## Problem

Carlos migrated Monday to **one dedicated board per module** and decommissioned
the two old combined boards the console still reads:

- `18402839374` (Stories board → `pe/vt/uw/lexi` via the `module` column) — gone.
- `18403908550` (shared Analyzers board → `tax`) — gone.

`/api/refresh` fetches both in one `Promise.all`; a decommissioned board makes
Monday return HTTP 200 with `errors`/no board, so `fetchBoardStories` throws and
the whole refresh 500s. The blob has been frozen since 2026-07-07 (all modules
`assumed`); `/api/readiness` still serves that last-good blob, so the site is up
but stale. This is pre-existing and independent of the analyzer-boards change.

## Confirmed board map (workspace LendLogic, status column `task_status`, read whole — no `module` routing)

| Module | Board | Live? |
|--------|-------|-------|
| pe | Pricing and Eligibility `18420951236` (102 items, all `module=Pricing and Eligibility`) | live |
| uw | Underwriting `18420951193` (91 items) | live |
| vt | — none | hidden |
| lexi | — none | hidden |
| bank | Analyzers: Bank Statement `18420951194` | live |
| id | Analyzers: ID `18420951197` | live |
| pl | Analyzers: P&L `18420951201` | live |
| paystub | Analyzers: Paystub `18420951200` | live |
| tax | — none (old shared board gone) | hidden |

Sampling confirmed each per-module board is dedicated (every item carries the
board's own module label); the `module` column is vestigial.

## Design (backend only — the SPA already renders whatever module subset the payload contains)

### 1. Unified module→board map — `api/_lib/config.ts`

- Introduce `MODULE_BOARDS: Record<ModuleKey, number | null>`:
  ```
  pe: 18420951236,  vt: null,  uw: 18420951193,  lexi: null,
  bank: 18420951194, id: 18420951197, pl: 18420951201, paystub: 18420951200,
  tax: null,
  ```
  Each non-null default overridable by env (`ID_MONDAY_PE`, `ID_MONDAY_UW`,
  `ID_MONDAY_BANK`, `ID_MONDAY_ID`, `ID_MONDAY_PL`, `ID_MONDAY_PAYSTUB`; and
  `ID_MONDAY_VT`, `ID_MONDAY_LEXI`, `ID_MONDAY_TAX` for when those boards exist).
- `getModuleBoardId(key): number | null` — env override (valid positive int) else default.
- `boardBackedKeys(): ModuleKey[]` — keys whose resolved board id is non-null, in
  canonical `MODULE_ORDER` order. This is the **visible** module set.
- All dedicated boards use `statusColumnId: 'task_status'`.
- **Remove the now-dead routing/shared-board machinery:** `BOARD_ID`/`getBoardId`,
  `ANALYZER_BOARD_ID`/`getAnalyzerBoardId`, `getAnalyzerColumnId`,
  `MODULE_COLUMN_ID`/`getModuleColumnId`, `MODULE_LABELS`, `SHARED_LABEL`,
  `moduleKeyForLabel`, `DEDICATED_ANALYZER_*`/`getDedicatedAnalyzerBoardId`.
  Keep `bucketForStatus`, `STATUS_BUCKET`, `statusFromPercent`, `STATUS_LABELS`,
  `cleanTitle`, `getMondayToken`, `getCronSecret`, `ANALYZER_KEYS` (re-export),
  and `MODULE_ORDER` (the canonical key order, sourced from `shared/readiness`).

### 2. Rollup — `api/_lib/rollup.ts`

- Replace `assembleLivePayload` with:
  `assembleLivePayload(storiesByModule: Partial<Record<ModuleKey, RawStory[]>>, now): ReadinessPayload`
  — for each key in `boardBackedKeys()`, build the module via the existing
  `buildDeliveryModule(key, storiesByModule[key] ?? [])` (empty/absent → assumed
  baseline). Emit modules in `boardBackedKeys()` order. `source: 'live'`.
- **Remove** `buildDeliveryModules`, `buildTaxModule`, and the private
  `buildModulesForKeys` (module routing is gone). Keep `buildDeliveryModule`.

### 3. Refresh — `api/refresh.ts` (resilience)

- Fetch each board-backed key's board concurrently, each wrapped so a failure
  yields `null` (not a throw):
  `fetchBoardStories({token, boardId, statusColumnId:'task_status'}).then(s=>s).catch(()=>null)`.
- Build `storiesByModule` from the successful fetches (null → omit → that module
  falls back to baseline via `buildDeliveryModule([])`).
- **Anti-clobber guard:** if **every** board-backed fetch returned null (systemic
  failure — bad token / Monday down), return 500 and do **not** write the blob
  (preserve last-good). If at least one succeeded, assemble and `writeLatest`.

### 4. Readiness baseline fallback — `api/readiness.ts`

- When the blob is missing, `buildPayload(now)` currently returns all 9 modules.
  Filter its `modules` to `boardBackedKeys()` so the boardless modules stay hidden
  in the fallback too. (`buildPayload` in `shared/` stays pure; the API layer filters.)

### Hiding semantics

- **No board configured (null)** → module omitted from the payload → hidden in the
  SPA (no tab/card). Restored automatically when its board id is added to
  `MODULE_BOARDS`/env.
- **Board configured but this cycle's fetch failed** → module shown with its
  **baseline (assumed)** figures (transient resilience), not hidden.
- Visible now: `pe, uw, bank, id, pl, paystub`. Hidden now: `vt, lexi, tax`.

## Out of scope

- Creating the vt/lexi/tax boards (Carlos's side). When they exist, add their ids
  to config/env — no code change beyond the mapping.
- The Vercel deploy of `main@cf2e328` not going live — a deployment/platform issue
  to resolve in the Vercel dashboard, separate from this code fix.

## Testing

- Config: `getModuleBoardId` default/env/invalid; `boardBackedKeys()` = the six
  board-backed keys in order (vt/lexi/tax excluded).
- Rollup: `assembleLivePayload` emits only board-backed modules in order; a module
  with stories → live; a board-backed module with no stories → assumed; boardless
  keys never appear.
- Refresh: all board-backed boards fetched with `task_status`; one board failing →
  that module baseline, others live, blob written; **all** failing → 500, no write.
- Readiness: baseline fallback contains only board-backed modules.

## Branch & phasing

Single fix branch `fix/refresh-resilient-per-module-boards`. Phases:
1. Config (map + visible keys, remove dead routing) + rollup (new assemble, remove routing) — together, tightly coupled.
2. Refresh resilience + anti-clobber.
3. Readiness baseline filter.
4. Verification (suite/build) + ledger + finish.
