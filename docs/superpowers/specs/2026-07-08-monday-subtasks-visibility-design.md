# Monday sub-tasks visible in the dashboard (display-only)

**Date:** 2026-07-08
**Status:** Approved (design)
**Branch:** `feature/monday-subtasks-visibility`

## Problem

Monday stories on the per-module boards can have **subitems** (sub-tasks). Today
the console only reads item-level stories, so a story like `U-02-ID · ID Analyzer`
appears as a single line even though it is broken into 10 sub-tasks that show what
is actually being worked on. This is the visibility gap: a 3-item board (ID
Analyzer) is really ~13 units of work once its sub-tasks are counted.

Confirmed against live data:

| Board | Sub-tasks today |
|-------|-----------------|
| ID Analyzer `18420951197` | 1 of 3 stories has sub-tasks: `U-02-ID` → **10** sub-tasks |
| Underwriting `18420951193` | 2 stories (`U-05-W2`, `U-05-1099`) → **7** sub-tasks each |
| PE / Bank / others | sub-tasks column exists but empty |

Adoption is early, so the feature adds visible value in a few cards now and grows
as teams populate sub-tasks.

## Confirmed Monday facts (workspace LendLogic)

- **Sub-items live on a separate board** per parent board (e.g. ID sub-items on
  `18420952990`). Their status column id is **`status`**, not the parent's
  `task_status`. This is the one real gotcha.
- The sub-item `status` column uses Monday's **default labels**: `Working on it`
  (amber), `Done` (green, `is_done`), `Stuck` (red); unset → empty. This vocabulary
  is a **subset** of the parent `STATUS_BUCKET` map — no new bucket table needed.
- Sub-items return inline within `items_page` (no separate cursor); real max ~10.
- Sub-task names carry a code prefix, e.g. `U-02-ID-01: Structured extraction`.

## Scope

**Display-only (Option A).** Sub-tasks are attached to their parent story for
rendering. They do **not** change the module `percent` or `counts` — those stay
story-level. **Invariant, covered by a test.**

Sub-tasks render in **any bucket** where the parent story has them
(Delivered / In Progress / Remaining), not only In Progress.

## Design

### 1. Fetch layer — `api/_lib/monday.ts`

- Extend the GraphQL query on **both** `items_page` and `next_items_page` to
  include `subitems { name column_values(ids: ["status"]) { id text } }`.
- `RawStory` gains `subtasks: RawSubtask[]`, where
  `RawSubtask = { name: string; status: string }`.
- `toStory` maps each subitem: `name`, and the `status` column `text` (unset → `''`).
- No second pagination pass for subitems (they come inline).

### 2. Config — `api/_lib/config.ts`

- Add `export const SUBITEM_STATUS_COLUMN_ID = 'status'` (used by the query builder).
- Add `cleanSubtaskTitle(name)`: strip a leading code prefix of the form
  `CODE: ` (e.g. `U-02-ID-01: `) → `Structured extraction`. The prefix must be a
  code-like hyphenated token of uppercase letters/digits so plain titles with a
  colon (e.g. `Note: …`) are left intact. Regex: `^[A-Z0-9]+(?:-[A-Z0-9]+)+:\s*`.
  Parent `cleanTitle` (middot `·` prefixes) is unchanged.
- Reuse `STATUS_BUCKET` / `bucketForStatus` for sub-task `done` derivation; no new
  bucket table.

### 3. Data model — `shared/readiness.ts`

- `BucketItem` gains `subtasks?: SubTask[]`.
- New type `SubTask = { title: string; status: string }` — **semantic** (stores the
  Monday status label, not a color). Tone and `done` are derived in the front-end,
  mirroring the existing `src/lib/statusPill.ts` pattern (payload stays presentation-light).

### 4. Rollup — `api/_lib/rollup.ts`

- In `buildDeliveryModule`, when pushing a story into its bucket, attach its
  `subtasks`: each `{ title: cleanSubtaskTitle(sub.name), status: sub.status }`.
- **Does not touch** `counts` or `percent`. A rollup test asserts a story with
  sub-tasks yields identical counts/percent to one without.
- Stories with no sub-tasks → `subtasks` omitted/empty.

### 5. Front-end — `src/components/BucketColumn.tsx`, `src/lib/subtaskStatus.ts`, `src/styles/app.css`

- New `src/lib/subtaskStatus.ts`: maps a sub-task status label →
  `{ tone: 'green' | 'amber' | 'grey' | 'red'; done: boolean }`:
  - `Done` → `{ green, done: true }`
  - `Working on it` / `In Progress` → `{ amber, done: false }`
  - `Stuck` → `{ red, done: false }`
  - `''` / unknown → `{ grey, done: false }`
- `BucketColumn`: for each item with `subtasks?.length`, render:
  - a roll-up badge next to the title: `{done}/{total} done` (done counted via
    `subtaskStatus`), and
  - a nested list, each row = a status **dot** (tone class) + the sub-task title.
- `DeliveryPanel` and `api/refresh.ts` are **unchanged** (sub-tasks flow through
  `fetchBoardStories` → `buildDeliveryModule` → `BucketItem`).
- CSS: `.subtasks` (nested list), `.subtask` (row), `.sdot.{green,amber,grey,red}`,
  and the roll-up badge, matching the existing bucket visual language.

## Error handling

- Missing / null `subitems` → empty array, no crash.
- Unset sub-item status → `''` → grey dot, not counted as done.
- A board that fails to fetch is already handled by `refresh.ts` resilience; this
  change adds no new failure mode.

## Out of scope

- Sub-tasks driving module `percent`/`counts` (the potential Option B follow-up).
- Populating sub-tasks in Monday (teams' operational work).
- Expand/collapse interaction — the list renders fully (real max ~10).

## Testing

- `monday.test.ts`: mock response with (a) a story with sub-items carrying status,
  (b) a sub-item with unset status, (c) a story with no sub-items; assert
  `RawStory.subtasks` parsed and the query string includes `subitems`.
- `rollup.test.ts`: a story with sub-tasks → `BucketItem.subtasks` populated with
  cleaned titles and statuses; **and** counts/percent identical to the no-subtask case.
- `subtaskStatus.test.ts`: label → `{ tone, done }` for Done / Working on it /
  Stuck / empty / unknown.
- `BucketColumn.test.tsx`: renders dots + roll-up `{done}/{total} done` when
  sub-tasks present; renders no sub-task list when absent.

## Branch & phasing

Single atomic feature branch `feature/monday-subtasks-visibility`. Phases:
1. Fetch + model: `monday.ts` (query + `RawStory.subtasks`), `shared/readiness.ts`
   (`SubTask`, `BucketItem.subtasks`), `config.ts` (`SUBITEM_STATUS_COLUMN_ID`,
   `cleanSubtaskTitle`) — tightly coupled.
2. Rollup: attach sub-tasks, invariant test.
3. Front-end: `subtaskStatus.ts`, `BucketColumn` render, CSS, component test.
4. Verification (suite/build) + ledger + finish.
