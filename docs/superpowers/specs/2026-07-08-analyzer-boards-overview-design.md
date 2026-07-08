# Per-analyzer Monday boards + Analyzers section with combined overview

**Date:** 2026-07-08
**Status:** Approved (design)
**Branch:** `feature/analyzer-boards-overview`

## Problem

Today the Readiness Console derives its analyzer modules (`bank`, `id`, `tax`)
from a single shared Monday board (`18403908550`), split apart by a `module`
status column. LendLogic has since moved to **one dedicated board per analyzer**
and added two new analyzers (P&L and Paystub). We need to:

1. Point Bank and ID at their new dedicated boards.
2. Add P&L and Paystub as new analyzer modules, each from its own board.
3. Keep Tax as-is (still read from the shared board by `module='Tax Analyzer'`).
4. Add a combined **Analyzers** overview view that rolls up all analyzers.

The delivery modules (`pe`, `vt`, `uw`, `lexi`) are out of scope and stay
untouched.

## Source boards (Monday, workspace "LendLogic", `viewnear-company.monday.com`)

| Analyzer | Board name | Board ID | Status column | Module filter |
|----------|-----------|----------|---------------|---------------|
| Bank Statement | Analyzers: Bank Statement Analyzer | `18420951194` | `task_status` | none (dedicated) |
| ID | Analyzers: ID Analyzer | `18420951197` | `task_status` | none (dedicated) |
| P&L | Analyzers: P&L Analyzer | `18420951201` | `task_status` | none (dedicated) |
| Paystub | Analyzers: Paystub Analyzer | `18420951200` | `task_status` | none (dedicated) |
| Tax Docs | (shared) | `18403908550` | `status` | `module='Tax Analyzer'` |

**Dedicated boards are read whole**: every story on the board belongs to that
analyzer, so we do **not** filter by the `module` column. This is deliberate —
the `module` column on the new boards is unreliable (the single P&L story is
tagged `Tax Analyzer`, the Paystub story `Underwriting`). The board identity is
the source of truth, not the column.

All new boards share the same status label set already handled by
`STATUS_BUCKET`: `In Progress`, `Done`, `QA`, `Code Review`, `Ready to start`,
`Stuck`.

## Design

### 1. Shared model — `shared/readiness.ts`

- Extend `ModuleKey` with `'pl'` and `'paystub'`.
- Add baseline `DeliveryModule` definitions for `pl` and `paystub`
  (name, sub, `accentColor`, `targetDate`, `assumed: true` fallback figures),
  following the existing `bank`/`id`/`tax` baseline shape.
- Append them to `MODULES` so the payload order becomes:
  `[pe, vt, uw, lexi, bank, id, pl, paystub, tax]` (9 modules).

Proposed baseline metadata:

- `pl` — name "P&L Analyzer", sub "Profit & Loss statement extraction for
  self-employed Non-QM income.", accent `#C77DBB` family (distinct from
  siblings), `assumed: true`, `assumedLabel: 'Awaiting board data'`.
- `paystub` — name "Paystub Analyzer", sub "Income extraction and verification
  from paystubs.", accent distinct, `assumed: true`,
  `assumedLabel: 'Awaiting board data'`.

(Exact accent hex chosen during implementation to stay visually distinct from
the existing analyzer accents.)

### 2. Config — `api/_lib/config.ts`

- Add `'pl'` and `'paystub'` to the `ModuleKey` union.
- Redefine analyzer grouping:
  - `ANALYZER_KEYS = ['bank', 'id', 'pl', 'paystub', 'tax']`
  - `DEDICATED_ANALYZER_KEYS = ['bank', 'id', 'pl', 'paystub']`
- Add a per-analyzer source map for the dedicated boards, each overridable by an
  env var (mirroring the existing `getBoardId()` / `ID_MONDAY` pattern):

  ```
  bank    → 18420951194   (env: ID_MONDAY_BANK)
  id      → 18420951197   (env: ID_MONDAY_ID)
  pl      → 18420951201   (env: ID_MONDAY_PL)
  paystub → 18420951200   (env: ID_MONDAY_PAYSTUB)
  ```

  Dedicated boards use `statusColumnId: 'task_status'` and **no** module column.
- Tax keeps the current shared-board path: `ANALYZER_BOARD_ID` (`18403908550`),
  `statusColumnId: 'status'`, module column via `getAnalyzerColumnId()`, label
  `'Tax Analyzer'`.
- The four env keys above are documented in `.env.example` as part of the change.

### 3. Rollup — `api/_lib/rollup.ts`

- Add `buildDedicatedAnalyzer(key, stories)` that reuses the existing
  `buildDeliveryModule` logic (all stories count toward the one analyzer; no
  `module` routing).
- Keep the shared-board module-routing path for Tax only.
- Update `assembleLivePayload` to accept: delivery stories, a per-analyzer map of
  dedicated-board stories, and tax stories; assemble all 9 modules in order.

### 4. Refresh — `api/refresh.ts`

- Fetch six boards in `Promise.all`: the delivery board + the four dedicated
  analyzer boards (`statusColumnId: 'task_status'`, no module column) + the
  shared board for Tax (as today).
- Pass the results into the updated `assembleLivePayload`.

### 5. API — `api/readiness.ts`

- Contract unchanged; now returns 9 modules. The baseline fallback
  (`buildPayload`) already includes the new modules via `MODULES`.

### 6. UI

Two-tier navigation:

- **Top level:** `pe`, `vt`, `uw`, `lexi`, and a synthetic **Analyzers** entry.
- **Analyzers sub-nav:** `Overview`, `Bank`, `ID`, `P&L`, `Paystub`, `Tax`.
- App state: `activeSection` (top) + `activeAnalyzer` (sub, defaults to
  `Overview`).
- Individual analyzer views reuse the existing `DeliveryPanel`.
- New `AnalyzersOverview` component:
  - **Global readiness %**: story-weighted —
    `sum(delivered across the 5 analyzers) / sum(total across the 5 analyzers)`,
    rounded. (Chosen over a plain average of percentages so a well-populated
    analyzer isn't outweighed by a sparse one.)
  - A grid of summary cards, one per analyzer: name, %, status pill, mini
    progress bar, accent color.
  - Clicking a card selects that analyzer's sub-tab.

The `Tabs` component is generalized (or a second sub-tab row added) to render the
two levels; keep the existing tab styling.

### 7. Tests (TDD, matching existing `*.test.ts`)

- Config: dedicated-board source map returns the right board id / status column;
  env overrides win.
- Rollup: `buildDedicatedAnalyzer` buckets a board's stories with no module
  routing; `assembleLivePayload` produces 9 modules in the right order; Tax still
  routes by module label.
- Model: `pl` and `paystub` present in `MODULES` / baseline payload.
- UI: `AnalyzersOverview` global-% calculation; card click selects the analyzer.

## Deployment & operational notes

- **Env vars**: add optional overrides for the four dedicated board IDs to
  `.env.example`.
- **Token access (pre-deploy check)**: production `MONDAY_API_TOKEN` must be able
  to read the four new boards. Same workspace (LendLogic) as the boards it
  already reads, so likely fine, but confirm with a `refresh` run before calling
  it done.
- **Sparse live data**: the new boards are lightly seeded — P&L and Paystub each
  have one `Ready to start` story → 0% / early build; ID is 0% (no Done); Bank is
  ~67% (2 of 3 Done). These are real live figures. If they read too low for a
  demo, that's a Monday data-seeding task, not a code change.

## Out of scope

- Migrating the delivery modules (`pe`, `vt`, `uw`, `lexi`) to the new
  per-module boards Carlos is creating (`Pricing and Eligibility`,
  `Underwriting`, `Conditions`, …). Noted for a future change.
- Creating or seeding a dedicated Tax board.

## Branch & phasing

Single feature branch `feature/analyzer-boards-overview`. Implementation phases:

1. Model + config + rollup + their tests.
2. Refresh fetching wired to the new sources.
3. UI: two-tier nav + `AnalyzersOverview`.
4. Verification (build/typecheck/tests + a `refresh` smoke run) and deploy.
