# Add the Broker LOS module (new per-module Monday board)

**Date:** 2026-07-08
**Status:** Approved (design)
**Branch:** `feature/broker-los-board`

## Problem

Rene created a new dedicated Monday board **"Broker LOS"** (`18420631446`, workspace
LendLogic, 36 items) tracking the broker-facing loan origination system. The console
has no module for it, so it never appears. This is a brand-new module — not one of the
hidden `vt`/`lexi`/`tax` placeholders.

## Board finding (why this is more than a config toggle)

Every existing per-module board keeps its story status in the **`task_status`** column,
and `api/refresh.ts` hardcodes `statusColumnId: 'task_status'` for all boards. The
Broker LOS board instead uses the Monday-default **`status`** column. If we only added
the board id, `fetchBoardStories` would request a non-existent `task_status` column →
every item reads blank → everything buckets to `remaining` → the module shows 0%.

So the module status column must become **per-module**, defaulting to `task_status`.

Confirmed against the live board (`status` column, real data):

- Labels present: `Done`, `Working on it`, blank/`null`. All already covered by
  `STATUS_BUCKET` (Done→delivered, Working on it→inProgress, blank→remaining).
- Distribution today: 10 Done · 3 Working on it · 23 blank (mostly the
  "Tech Stack & Dependencies" and unstatused "New Initiatives" groups) → **28%**,
  `Early build`, note `10 of 36 stories accepted.`
- Subitem status column is `status` — already what the sub-tasks pipeline reads.

The blank tech-stack items counting toward `remaining` is faithful to the board; it is
board data, not a code concern. The % rises on its own as Rene marks those items.

## Design

### 1. New delivery module — `shared/readiness.ts`

Add a `broker` `DeliveryModule`:

- `key: 'broker'`, `name: 'Broker LOS'`, `sub: 'Broker-facing loan origination system.'`
- `phase: 'delivery'`, `targetDate: 'Release Two'`, `dateConfidence: 'projected'`,
  `accentColor: '#3D6CC4'` (a blue not used by any other module).
- Baseline (fallback) figures mirror pl/paystub: `percent: 0`, `status: 'early'`,
  `statusLabel: 'Early build'`, `note: 'Dedicated board just seeded. Figures assumed until stories land.'`,
  `assumed: true`, `assumedLabel: 'Awaiting board data'`, empty counts/buckets.
  The live rollup overrides percent/status/note/counts/buckets; name/sub/targetDate/
  accentColor stay from this baseline.

Insert into `MODULES` **after `lexi`**: `[pe, vt, uw, lexi, broker, bank, id, pl, paystub, tax]`.
It is a delivery module, **not** an analyzer — `ANALYZER_KEYS` unchanged.

### 2. Board map + per-module status column — `api/_lib/config.ts`

- `ModuleKey` union += `'broker'` (placed after `lexi`).
- `MODULE_BOARD_DEFAULTS.broker = 18420631446`; `MODULE_BOARD_ENV.broker = 'ID_MONDAY_BROKER'`.
- New `MODULE_STATUS_COLUMN: Record<ModuleKey, string>` — all `'task_status'` except
  `broker: 'status'` — plus `getModuleStatusColumnId(key): string`. A full `Record`
  (like the two sibling board maps) so any future module must declare its status
  column — the exact safeguard this board would have needed.

### 3. Refresh uses the per-module column — `api/refresh.ts`

Replace `statusColumnId: 'task_status'` with `statusColumnId: getModuleStatusColumnId(k)`.

## Out of scope / no change

- **Frontend** — it iterates the payload and never hardcodes module keys; a new
  delivery module tab/card appears automatically.
- `ANALYZER_KEYS` — Broker LOS is not an analyzer.
- `ID_MONDAY_BROKER` env var in Vercel — optional; the code default already resolves.

## Testing

- `config`: `getModuleStatusColumnId` → `task_status` by default, `status` for broker;
  `MODULE_ORDER` includes broker after lexi; `boardBackedKeys()` = the seven board-backed
  keys `['pe','uw','broker','bank','id','pl','paystub']`.
- `refresh`: seven boards fetched; the Broker LOS board (`18420631446`) fetched with
  `status`, the rest with `task_status`.
- `readiness`: baseline fallback now lists broker among the board-backed modules.
- `shared/readiness`: ten modules in tab order; broker flagged assumed in the baseline.

## Branch & phasing

Single feature branch `feature/broker-los-board`, one cohesive change (TDD red→green):

1. Tests updated/added to the new expectations (red).
2. Product code: `shared/readiness.ts` + `config.ts` + `refresh.ts` (green).
3. Verification: full suite + `npm run build`. Record in the SDD ledger.

**Deploy-time (manual, not code):** the live rollup runs on the cron `/api/refresh`
(`MONDAY_API_TOKEN` is cron-only, not local), so confirm Broker LOS renders with real
data via a deploy + refresh. Logic verified by the suite.
