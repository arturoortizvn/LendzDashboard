# Design — Phase 2B: Bank module live from the Metrics board

**Date:** 2026-06-19
**Status:** approved (brainstorming) — pending spec review
**Scope of this doc:** Phase 2B only — wire the `bank` module to live data from the "Bank Analyzer - Dashboard Metrics" Monday board, behind the unchanged `GET /api/readiness` contract. `bank` converts from a `measurement` module to a `delivery` module. The "Workstream: Analyzers" board is explicitly out of scope.

## 1. Context and goal

Phase 2a wired the six **delivery** modules (pe, vt, uw, lexi, id, tax) to live Monday data from the Stories board (`18402839374`), behind `GET /api/readiness`. The `bank` module stayed a static `measurement` fixture (77%, six KPIs) because its data source was undefined — it was "blocked on Javi" for a metrics DB.

That block is resolved differently than the original roadmap assumed. Javi's team built a **separate Bank Analyzer dashboard app** that computes the six real KPIs (extraction accuracy, detection, output contract, coverage, speed, cost) from its own backend. The Monday board **"Bank Analyzer - Dashboard Metrics"** (`18418407276`) tracks the engineering work on that app — 16 task items in 4 groups, currently all `Done`. The real KPI **values** live in that app's API/DB, **not** in Monday.

**Decision (brainstorming, 2026-06-19):** rather than pull real KPI values, Phase 2B rolls up the Metrics board by task status — same pattern as Phase 2a — so `bank` shows **build progress** of the Bank Analyzer workstream, not the real KPIs. `bank` therefore converts to a `delivery` module and renders with the standard `DeliveryPanel`.

## 2. Scope

**Phase 2B (this spec):**
- Fetch all items from the Metrics board (`18418407276`) and roll them up into the single `bank` module.
- Derive **live** for `bank`: `counts`, `percent`, `status`/`statusLabel`, `note`, and `buckets` items (task titles grouped by status).
- Convert `bank` from `MeasurementModule` to `DeliveryModule`; keep its slot/order in the modules list.
- Remove the now-dead measurement code path (types, components, fixture, tests) since `bank` was the only measurement module.
- Vitest coverage on the bank rollup, the generalized connector, and the two-board refresh. Existing suite stays green.

**Out of scope:**
- **"Workstream: Analyzers" board (`18403908550`):** a 79-item, all-`Not Started` engineering plan for the generic analyzer backend service. Forward-looking infra with no console-module dimension. Revisit in a later phase (may feed id/tax or a new platform module).
- Pulling the real KPI **values** from Javi's Bank Analyzer dashboard API. Deliberately not done this round (chosen: progress rollup, not real KPIs).

**Non-goals:** no writes to Monday, no webhooks/realtime, no UI redesign, no new cron/Blob infra, no change to the request path.

## 3. Key facts about the Metrics board (verified via MCP 2026-06-19)

Board `18418407276` "Bank Analyzer - Dashboard Metrics" (workspace LendLogic, creator Javier Cobos), 16 items, 4 groups:

- **Status column** is `status` (NOT `task_status` like the Stories board), with labels: `Working on it`, `Done`, `Stuck`, `Not Started`. All 16 items are currently `Done`.
- **No module column** — every item belongs to `bank`. No per-item module mapping needed.
- Groups: `Metrics – Real Data Integration` (9), `Dashboard UX & Design` (2), `Authentication` (3), `CI/CD & Build` (2). The metrics group contains items named after `METRIC 01–06`.
- **Rollup scope (decided):** count **all 16 items** (the whole Bank Analyzer workstream), not just the metrics group. Today → 16/16 Done → 100%.

## 4. Decisions (brainstorming)

1. **Source:** roll up the Metrics board by task status (build progress), not real KPI values.
2. **Mapping:** `bank` ← Metrics board only; the Analyzers workstream board is out of scope for 2B.
3. **Shape:** `bank` becomes a `DeliveryModule` rendered with `DeliveryPanel`; the measurement panel/types are removed.
4. **Rollup scope:** all 16 board items.
5. **Status → bucket (consistent with Phase 2a, Stuck = remaining):**

   | Metrics board `status` | bucket |
   |---|---|
   | Done | delivered |
   | Working on it | inProgress |
   | Stuck, Not Started, (blank) | remaining |

6. **Editorial copy:** name stays `Bank Statement Analyzer`; `sub` changes to build-progress framing (`Document-extraction analyzer — build progress.`); keep `targetDate`.
7. **Failure mode / store:** unchanged from 2a — cron writes last-known-good to Vercel Blob; on any fetch failure do not overwrite.

## 5. Connector changes (`api/_lib/monday.ts`)

`fetchBoardStories` currently hardcodes the `task_status` column and requires a `moduleColumnId`. Generalize minimally:

- Add `statusColumnId?: string` (default `task_status`).
- Make `moduleColumnId?: string` optional. When absent, the requested columns omit it and `RawStory.module` is `null`.
- `toStory` reads the status from `statusColumnId` and the module from `moduleColumnId` only when provided.

The bank fetch call: `fetchBoardStories({ token, boardId: getMetricsBoardId(), statusColumnId: 'status' })`. The Stories-board call is unchanged (defaults preserve current behavior). Cursor pagination and error propagation are reused as-is; 16 items fit in one page.

## 6. Rollup changes (`api/_lib/rollup.ts`)

- Add `buildBankModule(stories: RawStory[]): DeliveryModule`:
  1. Bucket each story by `bucketForStatus(s.status)` using the extended `STATUS_BUCKET` (§4.5) → `counts { delivered, inProgress, remaining }`.
  2. `total === 0` → return the bank baseline config with `assumed: true` (board unreachable/empty → look like baseline, honest).
  3. `percent = round(delivered / total * 100)`; `status = statusFromPercent(percent)`; `statusLabel = STATUS_LABELS[status]`.
  4. `note = "{delivered} of {total} build items complete."` (templated).
  5. `buckets` list cleaned titles (`cleanTitle` reused; harmless for these names).
  6. Spread over the bank delivery baseline for editorial fields (`name`, `sub`, `targetDate`, `dateConfidence`, `accentColor`).
- `assembleLivePayload(storyStories, bankStories, now)`: build delivery modules from the Stories board (as today) and `bank` from `bankStories`; assemble in order `[pe, vt, uw, lexi, bank, id, tax]`; `source: 'live'`, `builtAt: now`.

## 7. Contract / shared changes (`shared/readiness.ts`)

- `bank` becomes a `DeliveryModule` (`phase: 'delivery'`). Add a bank **delivery baseline** object with editorial fields and baseline counts/buckets (served when the board is empty or the Blob is missing).
- **Remove** `MeasurementModule` and `Metric` interfaces and the measurement bank fixture. `Module = DeliveryModule` (the discriminated union collapses to one member).
- `buildPayload(now)` and `MODULES`/`MODULES_BY_KEY` updated to use the bank delivery baseline; module order unchanged.
- This is **frontend-compatible**: the union narrows (no shape a consumer relied on disappears except the measurement branch, which is removed in lockstep with its only renderer).

## 8. Frontend changes (`src/`)

- `App.tsx`: drop the `phase === 'measurement'` branch; always render `DeliveryPanel`.
- **Remove** `src/components/MeasurementPanel.tsx`, `src/components/MetricsTable.tsx` and their tests (`MeasurementPanel.test.tsx`, `MetricsTable.test.tsx`) — dead once `bank` is delivery.
- No CSS or other component changes; `bank` reuses the existing `DeliveryPanel` layout.

## 9. Config changes (`api/_lib/config.ts`)

- Add `METRICS_BOARD_ID = 18418407276` constant and `getMetricsBoardId()` reading `ID_MONDAY_METRICS` with that fallback (env var already set in Vercel Prod+Preview and documented in `.env.example`).
- Extend `STATUS_BUCKET` with the Metrics board labels: `'Working on it' → inProgress`, `'Not Started' → remaining` (`Done` and `Stuck` already mapped to delivered/remaining respectively, matching §4.5).

## 10. Data flow

**Cron (`GET /api/refresh`, guarded by `CRON_SECRET`):**
1. Fetch Stories board → delivery stories (as today).
2. Fetch Metrics board → bank stories (`statusColumnId: 'status'`, no module column).
3. `assembleLivePayload(storyStories, bankStories, now)`.
4. `writeLatest(payload)` to the existing private Blob.

If **either** fetch throws → the handler returns 500 and the Blob is **not** overwritten (last-known-good preserved), matching Phase 2a. A missing `MONDAY_API_TOKEN`/`CRON_SECRET` still fails loudly.

**Request (`GET /api/readiness`):** unchanged — reads the Blob; Blob missing/unreadable → config baseline with `source: 'baseline'`.

## 11. Testing strategy (TDD: red → green → refactor)

Vitest. The implementer writes and runs the tests.

- `rollup.test.ts`: `buildBankModule` — status→bucket mapping for `Done`/`Working on it`/`Stuck`/`Not Started`; counts/percent; `total === 0` → assumed/baseline; bucket-item titles. A realistic 16-item Metrics-board fixture (captured via MCP) drives it.
- `monday.test.ts`: `fetchBoardStories` with `statusColumnId: 'status'` and no `moduleColumnId` → `module` null; column-id selection; default path (Stories board) still requests `task_status` + module column.
- `refresh.test.ts`: two-board fetch assembles bank live; a Metrics-board fetch failure does **not** overwrite the Blob and returns non-200.
- `readiness.test.ts`: bank present as a delivery module in both live and baseline payloads.
- App / component tests: update for `bank` rendering via `DeliveryPanel`; **remove** `MeasurementPanel.test.tsx` and `MetricsTable.test.tsx`.
- The existing suite (62 tests) stays green except the intentionally removed measurement tests.

## 12. Security / deploy

- `ID_MONDAY_METRICS` is a server-side, non-secret board id — already set in Vercel (Prod + Preview) and in `.env.example`. The Monday token remains server-side only, used solely on the cron path.
- No new Blob store, no new cron entry — Phase 2B rides the existing `/api/refresh` schedule and Blob.
- `api/_lib/*.test.ts` stay excluded from deploy via `.vercelignore`. ESM relative imports inside `api/` keep explicit `.js` extensions (existing regression guard).
- Pre-merge: `git ls-files | grep -E '^\.env'` must be empty.

## 13. Open items and risks

- **100% reads as "done":** all 16 items are `Done`, so `bank` shows 100% build progress. That is honest for the chosen "build progress" semantics, but it is not the real KPI readiness. Acceptable per the brainstorming decision; revisit if stakeholders want real KPIs (would require Javi's dashboard API — a future phase).
- **Mixed-group counting:** counting all 16 items folds auth/CI/CD/UX work into the bank number. Chosen deliberately (whole-workstream progress); a later refinement could scope to the metrics group via the `Group` column if desired.
- **Analyzers board deferred:** the 79-item Analyzers workstream is not surfaced anywhere yet; if stakeholders expect analyzer-platform progress on the console, that is a follow-up phase.
