# Design — Phase 2B: Analyzer modules live from the Analyzers board

**Date:** 2026-06-19
**Status:** approved (brainstorming) — pending spec review
**Scope of this doc:** Phase 2B — wire the three analyzer modules (`bank`, `id`, `tax`) to live data from the "Workstream: Analyzers" Monday board, behind the unchanged `GET /api/readiness` contract, using the Phase 2a mapping-column pattern. `bank` converts from a `measurement` module to a `delivery` module. The "Bank Analyzer - Dashboard Metrics" board is dropped as a source.

## 1. Context and goal

Phase 2a wired the six delivery modules to the Stories board (`18402839374`) behind `GET /api/readiness`, with `vt`/`id`/`tax` held at agreed baselines via `FORCE_ASSUMED` and `bank` left as a static `measurement` fixture.

Stakeholders confirmed (2026-06-19) that the **complete information for the three analyzer modules — `bank`, `id`, `tax` — will come from a single board: "Workstream: Analyzers" (`18403908550`)**. The earlier idea of sourcing `bank` from the "Bank Analyzer - Dashboard Metrics" board (`18418407276`) is dropped.

Phase 2B therefore:
- Moves `bank`, `id`, `tax` off their current sources (fixture / Stories rollup) and onto the Analyzers board.
- Reuses the proven Phase 2a contract: a dedicated mapping column on the board, referenced by env var, drives the rollup; modules with no coverage stay `assumed`.
- Converts `bank` to a `delivery` module (it shows build progress, not real KPIs) and removes the now-dead measurement code.

## 2. Scope

**Phase 2B (this spec):**
- Fetch items from the Analyzers board (`18403908550`) and roll them up into `bank`, `id`, `tax` by a new **"Module"** mapping column (labels `Bank`/`ID`/`Tax`/`Shared`).
- `Shared` items count toward all three analyzer modules; unlabeled items are excluded.
- Derive **live** per analyzer module: `counts`, `percent`, `status`/`statusLabel`, `note`, `buckets` (task titles grouped by status) — exactly as Phase 2a does for delivery modules.
- Convert `bank` from `MeasurementModule` to `DeliveryModule`; keep module order `[pe, vt, uw, lexi, bank, id, tax]`.
- Remove the dead measurement code (types, components, fixture, tests).
- Drop the Metrics board as a source: remove the `ID_MONDAY_METRICS` env var and its `.env.example` entry.
- Keep `bank`/`id`/`tax` **wiring-ready but `assumed`** (agreed baselines + badge) until the Analyzers board's Module column exists, is populated, and work has started.
- Vitest coverage on the analyzer rollup, the generalized connector, and the two-board refresh. Existing suite stays green (minus the intentionally removed measurement tests).

**Out of scope:**
- The "Bank Analyzer - Dashboard Metrics" board (`18418407276`) and its real KPI values.
- Surfacing the shared analyzer-platform progress (API Intake, Worker, DevOps, etc.) as its own console element. Shared items only contribute to the three analyzer modules.

**Non-goals:** no writes to Monday, no webhooks/realtime, no UI redesign, no new cron/Blob infra, no change to the request path.

## 3. Key facts about the Analyzers board (verified via MCP 2026-06-19)

Board `18403908550` "Workstream: Analyzers" (workspace LendLogic, creator Carlos Miranda), 79 items (77 real + 2 leftover "Item 4"/"Item 5" with all-null columns):

- **Status column** is `status` (NOT `task_status`), labels: `Working on it`, `Done`, `Stuck`, `Not Started`. **All real items are currently `Not Started`.**
- **No analyzer/module dimension today.** Items are grouped by 9 engineering phases (Discovery, API Intake, Queue, Worker, AI Classification, Security, Observability, DevOps, Testing). The per-analyzer line items live only in group 5 "AI Classification & Analyzer Layer": `Implement ID Document Analyzer`, `Implement Bank Statement Analyzer`, `Implement Tax Document Analyzer` (+ `Credit Report Analyzer`, not a console module). Everything else is shared infrastructure.
- There is a free-text `Tags` column (e.g. `ai,bank-statement`) but it is unreliable for mapping (mostly generic tags); rejected for the same reason Phase 2a rejected prefixes.

**Consequence:** like Phase 2a, the mapping must be established by a **new dedicated column** the team populates — not by parsing groups or tags. Until that column exists and is populated, every analyzer module reads empty → stays `assumed` → the dashboard renders like today.

## 4. Decisions (brainstorming)

1. **Source:** the Analyzers board is the **sole** source for `bank`/`id`/`tax`. The Metrics board is dropped.
2. **Mapping mechanism:** a new single-select **status "Module"** column on the Analyzers board, labels `Bank`/`ID`/`Tax`/`Shared`, referenced by env var (`MONDAY_ANALYZER_COLUMN_ID`). One label per item; `Shared` → counts for all three; empty → excluded. Reuses the Phase 2a mechanism.
3. **Shape:** `bank` becomes a `DeliveryModule` (renders with `DeliveryPanel`); measurement panel/types removed.
4. **Status → bucket (consistent with Phase 2a, Stuck = remaining):**

   | Analyzers board `status` | bucket |
   |---|---|
   | Done | delivered |
   | Working on it | inProgress |
   | Stuck, Not Started, (blank) | remaining |

5. **`assumed` policy:** `bank`/`id`/`tax` stay `FORCE_ASSUMED` (agreed baselines + badge) until the board is ready. Turning a module live is then a one-line config change (remove it from `FORCE_ASSUMED`) once it has tagged, started stories. `vt` stays force-assumed (still from the Stories board).
6. **Architecture split:** Stories board → `pe`/`vt`/`uw`/`lexi`; Analyzers board → `bank`/`id`/`tax`.

## 5. Connector changes (`api/_lib/monday.ts`)

`fetchBoardStories` hardcodes the `task_status` column and requires a `moduleColumnId`. Generalize minimally:

- Add `statusColumnId?: string` (default `task_status`); `toStory` reads status from it.
- Make `moduleColumnId?: string` optional. When empty/absent, omit it from the requested columns and set `RawStory.module = null`.

Two call sites:
- Stories board (unchanged behavior): `{ boardId: getBoardId(), moduleColumnId: getModuleColumnId() }` (defaults `statusColumnId` to `task_status`).
- Analyzers board: `{ boardId: getAnalyzerBoardId(), statusColumnId: 'status', moduleColumnId: getAnalyzerColumnId() }` — `getAnalyzerColumnId()` is `''` until the column exists, so `module` is null and all analyzer modules stay assumed.

Cursor pagination and error propagation are reused; 79 items fit in one page (limit 100).

## 6. Rollup changes (`api/_lib/rollup.ts`)

- Add `buildAnalyzerModules(stories: RawStory[]): Record<'bank'|'id'|'tax', DeliveryModule>`:
  1. Group stories by Module label via `moduleKeyForLabel` (extended for `Bank`/`ID`/`Tax`/`Shared`). A `Shared` story is appended to **all three** module buckets; `Bank`/`ID`/`Tax` to that one; unmapped excluded.
  2. For each of `bank`/`id`/`tax`, run the same per-module rollup as `buildDeliveryModule` (bucket by status, `counts`, `percent = round(delivered/total*100)`, `status`/`statusLabel`, templated `note`, `buckets` of cleaned titles).
  3. `FORCE_ASSUMED` or empty (`total === 0`) → return the baseline config with `assumed: true`.
- Refactor the shared per-module rollup body out of `buildDeliveryModule` so both the Stories and Analyzers paths reuse it (avoid duplication).
- `assembleLivePayload(storyStories, analyzerStories, now)`: build `pe`/`vt`/`uw`/`lexi` from `storyStories` (Stories board) and `bank`/`id`/`tax` from `analyzerStories` (Analyzers board); assemble in order `[pe, vt, uw, lexi, bank, id, tax]`; `source: 'live'`, `builtAt: now`.

## 7. Contract / shared changes (`shared/readiness.ts`)

- `bank` becomes a `DeliveryModule` (`phase: 'delivery'`). Add a `bank` delivery baseline with editorial fields and baseline counts/buckets (served while `assumed`). Editorial: name `Bank Statement Analyzer`; `sub` reworded to build-progress framing; baseline `percent` continues current display (`77`) until live; keep `assumedLabel`/badge.
- **Remove** `MeasurementModule` and `Metric` interfaces and the measurement bank fixture. `Module = DeliveryModule`.
- `buildPayload(now)`, `MODULES`, `MODULES_BY_KEY` updated to the bank delivery baseline; module order unchanged.
- Frontend-compatible: the discriminated union narrows to one member; the only removed shape (measurement) loses its sole renderer in lockstep (§8).

## 8. Frontend changes (`src/`)

- `App.tsx`: drop the `phase === 'measurement'` branch; always render `DeliveryPanel`.
- **Remove** `src/components/MeasurementPanel.tsx`, `src/components/MetricsTable.tsx` and their tests. `bank` reuses the existing `DeliveryPanel`; no CSS changes.

## 9. Config changes (`api/_lib/config.ts`)

- Add `ANALYZER_BOARD_ID = 18403908550` and `getAnalyzerBoardId()` reading `ID_MONDAY_ANALYZERS` (already set in Vercel Prod+Preview) with that fallback.
- Add `getAnalyzerColumnId()` reading `MONDAY_ANALYZER_COLUMN_ID` (default `''` — column not created yet).
- Extend `STATUS_BUCKET` with the Analyzers board labels: `'Working on it' → inProgress`, `'Not Started' → remaining` (`Done`/`Stuck` already mapped).
- Extend `MODULE_LABELS`/`moduleKeyForLabel` with `Bank → bank`, `ID → id`, `Tax → tax`, and a `Shared` sentinel handled by the rollup (fan-out to all three).
- `DELIVERY_KEYS` / module grouping: `pe`/`vt`/`uw`/`lexi` resolve from the Stories board; `bank`/`id`/`tax` from the Analyzers board. `FORCE_ASSUMED` = `{ vt, bank, id, tax }` initially.

## 10. Data flow

**Cron (`GET /api/refresh`, guarded by `CRON_SECRET`):**
1. Fetch Stories board → delivery stories (as today).
2. Fetch Analyzers board → analyzer stories (`statusColumnId: 'status'`, Module column when set).
3. `assembleLivePayload(storyStories, analyzerStories, now)`.
4. `writeLatest(payload)` to the existing private Blob.

If **either** fetch throws → 500 and the Blob is **not** overwritten (last-known-good preserved), matching Phase 2a.

**Request (`GET /api/readiness`):** unchanged — reads the Blob; missing/unreadable → config baseline with `source: 'baseline'`.

## 11. Testing strategy (TDD: red → green → refactor)

Vitest. The implementer writes and runs the tests.

- `rollup.test.ts`: `buildAnalyzerModules` — `Bank`/`ID`/`Tax` routing, `Shared` fan-out to all three, unmapped exclusion; status→bucket for `Done`/`Working on it`/`Stuck`/`Not Started`; counts/percent; `FORCE_ASSUMED` and `total === 0` → assumed baseline. A realistic Analyzers-board fixture (captured via MCP, incl. a `Shared` item and the two null leftovers) drives it.
- `monday.test.ts`: `fetchBoardStories` with `statusColumnId: 'status'` and empty `moduleColumnId` → `module` null; default path still requests `task_status` + module column.
- `refresh.test.ts`: two-board fetch assembles analyzers; an Analyzers-board fetch failure does **not** overwrite the Blob and returns non-200.
- `readiness.test.ts`: `bank`/`id`/`tax` present as delivery modules in live and baseline payloads.
- App / component tests: `bank` renders via `DeliveryPanel`; **remove** `MeasurementPanel.test.tsx`, `MetricsTable.test.tsx`.

## 12. Security / deploy / env

- `ID_MONDAY_ANALYZERS` (board id) already set in Vercel (Prod + Preview) and documented in `.env.example`.
- `MONDAY_ANALYZER_COLUMN_ID` is a new env var, **unset for now** (code defaults to `''`); the team sets it once the Module column exists. Document it in `.env.example`.
- **Remove** `ID_MONDAY_METRICS` from Vercel (Prod + Preview) and from `.env.example` — no longer a source.
- The Monday token stays server-side only, used solely on the cron path. No new Blob/cron infra. `api/_lib/*.test.ts` stay in `.vercelignore`; ESM imports under `api/` keep `.js` extensions.
- Pre-merge: `git ls-files | grep -E '^\.env'` must be empty.

## 13. Team handoff (gates live numbers, not the code)

Ships with the implementation, to Carlos's team:
- Add a single-select **status column titled "Module"** to board `18403908550` with labels exactly: `Bank`, `ID`, `Tax`, `Shared`.
- Tag each item: analyzer-specific work → `Bank`/`ID`/`Tax`; shared infrastructure that serves all analyzers → `Shared`; out-of-console work (e.g. Credit Report) → leave empty.
- Send the column id to set `MONDAY_ANALYZER_COLUMN_ID`. Until then the modules stay at their agreed baselines, badged, exactly like today.

## 14. Open items and risks

- **Everything is `Not Started`:** once tagged, a module computes to a low/zero percent. `FORCE_ASSUMED` keeps `bank`/`id`/`tax` at agreed baselines + badge until each is explicitly flipped live — avoids a premature 0%. The flip is a deliberate per-module config edit.
- **`Shared` granularity:** the single-select column can't express "serves Bank+ID but not Tax." Accepted — shared infrastructure is shared by all three. If finer attribution is ever needed, the column can become a multi-select dropdown (connector change only).
- **`bank` baseline semantics:** as a delivery module its baseline `percent` (77) is editorial continuity, not a measured KPI. Confirm the baseline number/copy during spec review.
- **Analyzer-platform progress not surfaced:** shared-infra build progress isn't shown as its own element; only folded into the three modules. A later phase could add a platform view if stakeholders want it.
