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
- Fetch items from the Analyzers board (`18403908550`) and roll them up into `bank`, `id`, `tax` by a new **"Module"** mapping column (labels `Bank`/`ID`/`Tax` — no `Shared`).
- Each item maps to exactly one analyzer module; unlabeled items are excluded.
- Derive **live** per analyzer module: `counts`, `percent`, `status`/`statusLabel`, `note`, `buckets` (task titles grouped by status) — exactly as Phase 2a does for delivery modules.
- `bank`/`id`/`tax` go **live** (no longer `FORCE_ASSUMED`); the Module column is created and populated 2026-06-19, so the modules show their real (initially low) percentages.
- Convert `bank` from `MeasurementModule` to `DeliveryModule`; keep module order `[pe, vt, uw, lexi, bank, id, tax]`.
- Remove the dead measurement code (types, components, fixture, tests).
- Drop the Metrics board as a source: remove the `ID_MONDAY_METRICS` env var and its `.env.example` entry.
- Vitest coverage on the analyzer rollup, the generalized connector, and the two-board refresh. Existing suite stays green (minus the intentionally removed measurement tests).

**Out of scope:**
- The "Bank Analyzer - Dashboard Metrics" board (`18418407276`) and its real KPI values.
- Surfacing the shared analyzer-platform progress (API Intake, Worker, DevOps, etc.) as its own console element. Shared infrastructure items are tagged per analyzer (or left empty) by the team; there is no console-level platform aggregate.

**Non-goals:** no writes to Monday, no webhooks/realtime, no UI redesign, no new cron/Blob infra, no change to the request path.

## 3. Key facts about the Analyzers board (verified via MCP 2026-06-19)

Board `18403908550` "Workstream: Analyzers" (workspace LendLogic, creator Carlos Miranda), 79 items (77 real + 2 leftover "Item 4"/"Item 5" with all-null columns):

- **Status column** is `status` (NOT `task_status`), labels: `Working on it`, `Done`, `Stuck`, `Not Started`. **All real items are currently `Not Started`.**
- **No analyzer/module dimension today.** Items are grouped by 9 engineering phases (Discovery, API Intake, Queue, Worker, AI Classification, Security, Observability, DevOps, Testing). The per-analyzer line items live only in group 5 "AI Classification & Analyzer Layer": `Implement ID Document Analyzer`, `Implement Bank Statement Analyzer`, `Implement Tax Document Analyzer` (+ `Credit Report Analyzer`, not a console module). Everything else is shared infrastructure.
- There is a free-text `Tags` column (e.g. `ai,bank-statement`) but it is unreliable for mapping (mostly generic tags); rejected for the same reason Phase 2a rejected prefixes.

**Consequence:** like Phase 2a, the mapping must be established by a **new dedicated column** the team populates — not by parsing groups or tags. The column is created and the items tagged 2026-06-19, so the analyzer modules go live this cycle. A module that happens to have zero tagged items falls back to its baseline (zero-coverage guard, §6) rather than dividing by zero.

## 4. Decisions (brainstorming)

1. **Source:** the Analyzers board is the **sole** source for `bank`/`id`/`tax`. The Metrics board is dropped.
2. **Mapping mechanism:** a new single-select **status "Module"** column on the Analyzers board, labels `Bank`/`ID`/`Tax` (no `Shared`), referenced by env var (`MONDAY_ANALYZER_COLUMN_ID`). Exactly one label per item; empty → excluded. Reuses the Phase 2a mechanism.
3. **Shape:** `bank` becomes a `DeliveryModule` (renders with `DeliveryPanel`); measurement panel/types removed.
4. **Status → bucket (consistent with Phase 2a, Stuck = remaining):**

   | Analyzers board `status` | bucket |
   |---|---|
   | Done | delivered |
   | Working on it | inProgress |
   | Stuck, Not Started, (blank) | remaining |

5. **`assumed` policy:** `bank`/`id`/`tax` are **removed from `FORCE_ASSUMED`** — they compute live from the (now populated) board, showing their real percentages even when low. The only remaining `assumed` path is the defensive zero-coverage guard: a module with no tagged items renders its baseline (badged) instead of dividing by zero. `vt` stays `FORCE_ASSUMED` (still sourced from the Stories board, unchanged this phase).
6. **Architecture split:** Stories board → `pe`/`vt`/`uw`/`lexi`; Analyzers board → `bank`/`id`/`tax`.

## 5. Connector changes (`api/_lib/monday.ts`)

`fetchBoardStories` hardcodes the `task_status` column and requires a `moduleColumnId`. Generalize minimally:

- Add `statusColumnId?: string` (default `task_status`); `toStory` reads status from it.
- Make `moduleColumnId?: string` optional. When empty/absent, omit it from the requested columns and set `RawStory.module = null`.

Two call sites:
- Stories board (unchanged behavior): `{ boardId: getBoardId(), moduleColumnId: getModuleColumnId() }` (defaults `statusColumnId` to `task_status`).
- Analyzers board: `{ boardId: getAnalyzerBoardId(), statusColumnId: 'status', moduleColumnId: getAnalyzerColumnId() }`. Once `MONDAY_ANALYZER_COLUMN_ID` is set, `module` carries the `Bank`/`ID`/`Tax` label; if the env var is still unset at deploy time, `module` is null and the modules degrade to the zero-coverage baseline until it is set.

Cursor pagination and error propagation are reused; 79 items fit in one page (limit 100).

## 6. Rollup changes (`api/_lib/rollup.ts`)

- Add `buildAnalyzerModules(stories: RawStory[]): Record<'bank'|'id'|'tax', DeliveryModule>`:
  1. Group stories by Module label via `moduleKeyForLabel` (extended for `Bank → bank`, `ID → id`, `Tax → tax`). Each story maps to one module; unmapped excluded.
  2. For each of `bank`/`id`/`tax`, run the same per-module rollup as `buildDeliveryModule` (bucket by status, `counts`, `percent = round(delivered/total*100)`, `status`/`statusLabel`, templated `note`, `buckets` of cleaned titles).
  3. Zero-coverage guard: empty (`total === 0`) → return the baseline config with `assumed: true` (avoids divide-by-zero). `bank`/`id`/`tax` are **not** in `FORCE_ASSUMED`, so any module with tagged items computes live.
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
- Add `getAnalyzerColumnId()` reading `MONDAY_ANALYZER_COLUMN_ID` (default `''`; set once the column exists).
- Extend `STATUS_BUCKET` with the Analyzers board labels: `'Working on it' → inProgress`, `'Not Started' → remaining` (`Done`/`Stuck` already mapped).
- Extend `MODULE_LABELS`/`moduleKeyForLabel` with `Bank → bank`, `ID → id`, `Tax → tax`.
- `DELIVERY_KEYS` / module grouping: `pe`/`vt`/`uw`/`lexi` resolve from the Stories board; `bank`/`id`/`tax` from the Analyzers board. `FORCE_ASSUMED` = `{ vt }` (bank/id/tax dropped — they go live).

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

- `rollup.test.ts`: `buildAnalyzerModules` — `Bank`/`ID`/`Tax` routing, unmapped exclusion; status→bucket for `Done`/`Working on it`/`Stuck`/`Not Started`; counts/percent for a module with tagged items (live, not assumed); `total === 0` → zero-coverage baseline. A realistic Analyzers-board fixture (captured via MCP, incl. the two null leftovers) drives it.
- `monday.test.ts`: `fetchBoardStories` with `statusColumnId: 'status'` and empty `moduleColumnId` → `module` null; default path still requests `task_status` + module column.
- `refresh.test.ts`: two-board fetch assembles analyzers; an Analyzers-board fetch failure does **not** overwrite the Blob and returns non-200.
- `readiness.test.ts`: `bank`/`id`/`tax` present as delivery modules in live and baseline payloads.
- App / component tests: `bank` renders via `DeliveryPanel`; **remove** `MeasurementPanel.test.tsx`, `MetricsTable.test.tsx`.

## 12. Security / deploy / env

- `ID_MONDAY_ANALYZERS` (board id) already set in Vercel (Prod + Preview) and documented in `.env.example`.
- `MONDAY_ANALYZER_COLUMN_ID` is a new env var set to the Module column id once the column is created (2026-06-19); code defaults to `''` so a not-yet-set deploy degrades gracefully. Document it in `.env.example` and set it in Vercel (Prod + Preview).
- **Remove** `ID_MONDAY_METRICS` from Vercel (Prod + Preview) and from `.env.example` — no longer a source.
- The Monday token stays server-side only, used solely on the cron path. No new Blob/cron infra. `api/_lib/*.test.ts` stay in `.vercelignore`; ESM imports under `api/` keep `.js` extensions.
- Pre-merge: `git ls-files | grep -E '^\.env'` must be empty.

## 13. Team handoff (gates live numbers, not the code)

Done by the team 2026-06-19 (in parallel with the implementation):
- Add a single-select **status column titled "Module"** to board `18403908550` with labels exactly: `Bank`, `ID`, `Tax`.
- Tag every item with the analyzer it serves (`Bank`/`ID`/`Tax`); out-of-console work (e.g. Credit Report) → leave empty. Shared-infrastructure items are attributed to a specific analyzer by the team (no `Shared` label).
- Send the column id so `MONDAY_ANALYZER_COLUMN_ID` is set in Vercel; the next cron rebuild turns the three modules live.

## 14. Open items and risks

- **Low percentages on launch:** the board starts mostly `Not Started`, so `bank`/`id`/`tax` will show low (possibly 0%) percentages — this is intended and honest, the modules are live. They rise as the team moves items to `Working on it`/`Done`. (Stakeholders accepted dropping the assumed baselines.)
- **`bank` baseline semantics:** the `bank` delivery baseline `percent` (77) now only renders via the zero-coverage guard (no tagged items). With the column populated today it won't show; confirm the baseline number/copy during spec review anyway.
- **Shared-infrastructure attribution:** with no `Shared` label, the team assigns each shared item to one analyzer. If an item genuinely serves all three, its progress only counts toward whichever module it's tagged — a known simplification. A multi-select column is a later option if needed.
- **Timing coupling:** live numbers depend on the team finishing the column + tagging and on `MONDAY_ANALYZER_COLUMN_ID` being set. If the deploy lands before the env var is set, the modules show the zero-coverage baseline until it is — no breakage.

## 16. Addendum — `Shared` label added (2026-06-19, new requirement)

After the initial ship, the team created the "Module" column as a **status** column (id **`color_mm4f6wz7`**, labels `ID`/`Bank`/`Tax`/`Shared`/`-`) and requested a **`Shared`** label (reversing §4.2's "no Shared"). Semantics: a story labeled `Shared` counts toward **all three** analyzer modules (bank, id, tax); `-`/empty/unmapped is excluded. Implemented via `SHARED_LABEL` in config and a fan-out in `rollup.buildModulesForKeys` (a `Shared` story is pushed into every key in the target set). The connector reads the status column's `text` (`"Bank"`/`"Shared"`/…) unchanged. As of this change all 77 items are tagged `Shared` and `Not Started`, so live bank/id/tax all compute to 0% over the same 77 remaining stories (identical until items are tagged to specific analyzers) — honest and intended.
