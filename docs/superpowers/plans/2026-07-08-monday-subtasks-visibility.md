# Monday Sub-tasks Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface Monday sub-items (sub-tasks) nested under their parent story in the dashboard bucket cards, read-only, with a per-sub-task status dot and a `X/Y done` roll-up.

**Architecture:** The existing pipeline is `fetchBoardStories` (Monday GraphQL) → `buildDeliveryModule` (rollup into buckets) → `BucketItem` payload → `BucketColumn` (React). We thread sub-tasks through the same path: fetch them into `RawStory.subtasks`, attach them (title-cleaned) onto `BucketItem.subtasks` in rollup, and render them in `BucketColumn`. Sub-task status → dot color/`done` is derived in the front-end, mirroring `src/lib/statusPill.ts`.

**Tech Stack:** TypeScript (strict), Vitest + React Testing Library, Vercel serverless functions (ESM), React 19, Vite.

## Global Constraints

- **Display-only invariant:** sub-tasks NEVER change a module's `percent` or `counts`. Those stay story-level. A rollup test asserts this.
- **ESM import extensions:** production code under `api/` and `shared/` imports sibling modules WITH a `.js` extension (enforced by `api/import-extensions.test.ts`). Test files and `src/` (React) import WITHOUT an extension.
- **Sub-item status column id is `status`** (not the parent's `task_status`); the sub-item board uses Monday default labels `Working on it` / `Done` / `Stuck` / unset.
- **Language:** code, identifiers, comments, commit messages in English. No comments unless they explain a non-obvious *why* (one line max).
- **Git:** work stays on `feature/monday-subtasks-visibility`. Checkpoint commit at the end of each task. Never commit to `main`/`develop`. Every commit message ends with the trailer `Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV`.
- **Commands:** full suite `npm test`; a single file `npx vitest run <path>`; typecheck+build `npm run build`.

---

### Task 1: Config helpers — `SUBITEM_STATUS_COLUMN_ID` + `cleanSubtaskTitle`

**Files:**
- Modify: `api/_lib/config.ts`
- Test: `api/_lib/config.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export const SUBITEM_STATUS_COLUMN_ID = 'status'`
  - `export function cleanSubtaskTitle(name: string): string`

- [ ] **Step 1: Write the failing test**

Add to `api/_lib/config.test.ts` — extend the import block to include `cleanSubtaskTitle` and `SUBITEM_STATUS_COLUMN_ID`, then add:

```ts
test('SUBITEM_STATUS_COLUMN_ID is the Monday default status column id', () => {
  expect(SUBITEM_STATUS_COLUMN_ID).toBe('status')
})

test('cleanSubtaskTitle strips a hyphenated code prefix but leaves plain colons intact', () => {
  expect(cleanSubtaskTitle('U-02-ID-01: Structured extraction')).toBe('Structured extraction')
  expect(cleanSubtaskTitle('U-05-1099-07: Regression test dataset (delivery requirement)')).toBe(
    'Regression test dataset (delivery requirement)',
  )
  expect(cleanSubtaskTitle('Note: something')).toBe('Note: something')
  expect(cleanSubtaskTitle('Plain title')).toBe('Plain title')
})
```

The import line at the top of the file becomes:

```ts
import {
  bucketForStatus,
  cleanTitle,
  cleanSubtaskTitle,
  statusFromPercent,
  ANALYZER_KEYS,
  MODULE_ORDER,
  getModuleBoardId,
  boardBackedKeys,
  SUBITEM_STATUS_COLUMN_ID,
} from './config'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/config.test.ts`
Expected: FAIL — `cleanSubtaskTitle is not a function` / `SUBITEM_STATUS_COLUMN_ID` undefined.

- [ ] **Step 3: Write minimal implementation**

In `api/_lib/config.ts`, add (next to `cleanTitle`):

```ts
export const SUBITEM_STATUS_COLUMN_ID = 'status'

export function cleanSubtaskTitle(name: string): string {
  return name.replace(/^[A-Z0-9]+(?:-[A-Z0-9]+)+:\s*/, '').trim()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/config.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/config.ts api/_lib/config.test.ts
git commit -m "Add sub-item status column id and sub-task title cleaner

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV"
```

---

### Task 2: Fetch sub-items — `monday.ts` query + `RawStory.subtasks`

**Files:**
- Modify: `api/_lib/monday.ts`
- Test: `api/_lib/monday.test.ts`

**Interfaces:**
- Consumes: `SUBITEM_STATUS_COLUMN_ID` from `./config.js` (Task 1).
- Produces:
  - `export interface RawSubtask { name: string; status: string }`
  - `RawStory` gains `subtasks?: RawSubtask[]` (always populated by `toStory`, even as `[]`).

- [ ] **Step 1: Write the failing test**

First, update the TWO existing exact-equality assertions in `api/_lib/monday.test.ts` so every expected story carries `subtasks: []` (the mocks have no sub-items):

In `paginates via cursor and maps name/status/module`, the expected array becomes:

```ts
  expect(stories).toEqual([
    { name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility', subtasks: [] },
    { name: 'CLTV issue', status: 'In Progress', module: null, subtasks: [] },
  ])
```

In `reads a custom status column and omits the module column when absent`, the expected array becomes:

```ts
  expect(stories).toEqual([
    { name: 'Implement Bank Statement Analyzer', status: 'Not Started', module: null, subtasks: [] },
  ])
```

Then add two new tests:

```ts
test('parses sub-items into subtasks with their status, unset status → empty string', async () => {
  const page = { boards: [{ items_page: { cursor: null, items: [
    { name: 'U-02-ID · ID Analyzer', column_values: [{ id: 'task_status', text: 'In Progress' }],
      subitems: [
        { name: 'U-02-ID-01: Structured extraction', column_values: [{ id: 'status', text: 'Done' }] },
        { name: 'U-02-ID-02: Provenance linking', column_values: [{ id: 'status', text: null }] },
      ] },
    { name: 'Story with no sub-items', column_values: [{ id: 'task_status', text: 'Done' }], subitems: [] },
  ] } }] }
  const fetchImpl = vi.fn().mockResolvedValueOnce(jsonRes(page))

  const stories = await fetchBoardStories({
    token: 't', boardId: 7, statusColumnId: 'task_status',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })

  expect(stories[0].subtasks).toEqual([
    { name: 'U-02-ID-01: Structured extraction', status: 'Done' },
    { name: 'U-02-ID-02: Provenance linking', status: '' },
  ])
  expect(stories[1].subtasks).toEqual([])
})

test('requests the subitems field with the sub-item status column', async () => {
  const page = { boards: [{ items_page: { cursor: null, items: [] } }] }
  const fetchImpl = vi.fn().mockResolvedValueOnce(jsonRes(page))
  await fetchBoardStories({
    token: 't', boardId: 7, statusColumnId: 'task_status',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })
  const sentBody = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body) as { query: string }
  expect(sentBody.query).toContain('subitems { name column_values(ids: ["status"])')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/monday.test.ts`
Expected: FAIL — new tests fail (`subtasks` undefined; query lacks `subitems`); updated equality tests also fail until `toStory` emits `subtasks`.

- [ ] **Step 3: Write minimal implementation**

In `api/_lib/monday.ts`:

Add the import at the top (WITH `.js` extension):

```ts
import { SUBITEM_STATUS_COLUMN_ID } from './config.js'
```

Add the raw sub-task type and extend `RawStory`:

```ts
export interface RawSubtask {
  name: string
  status: string
}

export interface RawStory {
  name: string
  status: string
  module: string | null
  subtasks?: RawSubtask[]
}
```

Extend the Monday item shape:

```ts
interface MondaySubitem {
  name: string
  column_values: MondayColumnValue[]
}

interface MondayItem {
  name: string
  column_values: MondayColumnValue[]
  subitems?: MondaySubitem[]
}
```

Extend `toStory`:

```ts
function toStory(item: MondayItem, statusColumnId: string, moduleColumnId?: string): RawStory {
  const textOf = (id: string) => item.column_values.find((c) => c.id === id)?.text ?? null
  return {
    name: item.name,
    status: textOf(statusColumnId) ?? '',
    module: moduleColumnId ? textOf(moduleColumnId) : null,
    subtasks: (item.subitems ?? []).map((s) => ({
      name: s.name,
      status: s.column_values.find((c) => c.id === SUBITEM_STATUS_COLUMN_ID)?.text ?? '',
    })),
  }
}
```

Inside `fetchBoardStories`, right after `cols` is computed, add a shared field selection and use it in BOTH queries (keeps the two query strings from diverging):

```ts
  const itemFields = `name column_values(ids: ${cols}) { id text } subitems { name column_values(ids: ["${SUBITEM_STATUS_COLUMN_ID}"]) { id text } }`
```

First query becomes:

```ts
    `query { boards(ids: ${boardId}) { items_page(limit: ${pageLimit}) { cursor items { ${itemFields} } } } }`,
```

Paginated query becomes:

```ts
      `query { next_items_page(limit: ${pageLimit}, cursor: "${page.cursor}") { cursor items { ${itemFields} } } }`,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/monday.test.ts`
Expected: PASS (all tests, including the two updated equality tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/monday.ts api/_lib/monday.test.ts
git commit -m "Fetch Monday sub-items into RawStory.subtasks

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV"
```

---

### Task 3: Attach sub-tasks in rollup — `SubTask` payload type + `buildDeliveryModule`

**Files:**
- Modify: `shared/readiness.ts`, `api/_lib/rollup.ts`
- Test: `api/_lib/rollup.test.ts`

**Interfaces:**
- Consumes: `RawStory.subtasks` / `RawSubtask` (Task 2), `cleanSubtaskTitle` from `./config.js` (Task 1).
- Produces:
  - `export interface SubTask { title: string; status: string }` in `shared/readiness.ts`
  - `BucketItem` gains `subtasks?: SubTask[]`

- [ ] **Step 1: Write the failing test**

Add to `api/_lib/rollup.test.ts`:

```ts
test('attaches cleaned sub-tasks to their parent story without changing counts or percent', () => {
  const withSubs: RawStory[] = [
    { name: 'ID Analyzer', status: 'In Progress', module: null, subtasks: [
      { name: 'U-02-ID-01: Structured extraction', status: 'Done' },
      { name: 'U-02-ID-02: Provenance linking', status: '' },
    ] },
    { name: 'Extraction spike', status: 'Done', module: null },
  ]
  const m = buildDeliveryModule('id', withSubs)
  const item = m.buckets.inProgress[0]
  expect(item.title).toBe('ID Analyzer')
  expect(item.subtasks).toEqual([
    { title: 'Structured extraction', status: 'Done' },
    { title: 'Provenance linking', status: '' },
  ])

  const withoutSubs = buildDeliveryModule('id', [
    { name: 'ID Analyzer', status: 'In Progress', module: null },
    { name: 'Extraction spike', status: 'Done', module: null },
  ])
  expect(m.counts).toEqual(withoutSubs.counts)
  expect(m.percent).toBe(withoutSubs.percent)
})

test('a story with no sub-tasks yields a bucket item without a subtasks field', () => {
  const m = buildDeliveryModule('id', [{ name: 'Plain story', status: 'Done', module: null }])
  expect(m.buckets.delivered[0].subtasks).toBeUndefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run api/_lib/rollup.test.ts`
Expected: FAIL — `item.subtasks` is `undefined` (not yet attached).

- [ ] **Step 3: Write minimal implementation**

In `shared/readiness.ts`, add the `SubTask` type and extend `BucketItem`:

```ts
export interface SubTask {
  title: string
  status: string
}

export interface BucketItem {
  title: string
  detail?: string
  weight?: number
  subtasks?: SubTask[]
}
```

In `api/_lib/rollup.ts`, add `cleanSubtaskTitle` to the existing `./config.js` import:

```ts
import {
  bucketForStatus,
  cleanTitle,
  cleanSubtaskTitle,
  statusFromPercent,
  STATUS_LABELS,
  boardBackedKeys,
  type ModuleKey,
} from './config.js'
```

Replace the bucketing loop in `buildDeliveryModule`:

```ts
  for (const s of stories) {
    const item: BucketItem = { title: cleanTitle(s.name) }
    const subs = s.subtasks ?? []
    if (subs.length) {
      item.subtasks = subs.map((t) => ({ title: cleanSubtaskTitle(t.name), status: t.status }))
    }
    buckets[bucketForStatus(s.status)].push(item)
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run api/_lib/rollup.test.ts`
Expected: PASS (all tests, including the pre-existing rollup tests).

- [ ] **Step 5: Commit**

```bash
git add shared/readiness.ts api/_lib/rollup.ts api/_lib/rollup.test.ts
git commit -m "Attach cleaned sub-tasks to bucket items (display-only)

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV"
```

---

### Task 4: Sub-task status → tone/done — `src/lib/subtaskStatus.ts`

**Files:**
- Create: `src/lib/subtaskStatus.ts`
- Test: `src/lib/subtaskStatus.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type SubtaskTone = 'green' | 'amber' | 'grey' | 'red'`
  - `export function subtaskStatus(status: string): { tone: SubtaskTone; done: boolean }`

- [ ] **Step 1: Write the failing test**

Create `src/lib/subtaskStatus.test.ts`:

```ts
import { expect, test } from 'vitest'
import { subtaskStatus } from './subtaskStatus'

test('maps sub-task statuses to a dot tone and a done flag', () => {
  expect(subtaskStatus('Done')).toEqual({ tone: 'green', done: true })
  expect(subtaskStatus('Working on it')).toEqual({ tone: 'amber', done: false })
  expect(subtaskStatus('In Progress')).toEqual({ tone: 'amber', done: false })
  expect(subtaskStatus('Stuck')).toEqual({ tone: 'red', done: false })
  expect(subtaskStatus('')).toEqual({ tone: 'grey', done: false })
  expect(subtaskStatus('Whatever')).toEqual({ tone: 'grey', done: false })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/subtaskStatus.test.ts`
Expected: FAIL — cannot find module `./subtaskStatus`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/subtaskStatus.ts`:

```ts
export type SubtaskTone = 'green' | 'amber' | 'grey' | 'red'

export function subtaskStatus(status: string): { tone: SubtaskTone; done: boolean } {
  switch (status) {
    case 'Done':
      return { tone: 'green', done: true }
    case 'Working on it':
    case 'In Progress':
      return { tone: 'amber', done: false }
    case 'Stuck':
      return { tone: 'red', done: false }
    default:
      return { tone: 'grey', done: false }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/subtaskStatus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/subtaskStatus.ts src/lib/subtaskStatus.test.ts
git commit -m "Add sub-task status to dot-tone/done mapping

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV"
```

---

### Task 5: Render sub-tasks — `BucketColumn` + CSS

**Files:**
- Modify: `src/components/BucketColumn.tsx`, `src/styles/app.css`
- Test: `src/components/BucketColumn.test.tsx` (create)

**Interfaces:**
- Consumes: `BucketItem` / `SubTask` from `../../shared/readiness` (Task 3), `subtaskStatus` from `../lib/subtaskStatus` (Task 4).
- Produces: rendered sub-task list + `X/Y done` roll-up in each bucket item.

- [ ] **Step 1: Write the failing test**

Create `src/components/BucketColumn.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { BucketColumn } from './BucketColumn'
import type { BucketItem } from '../../shared/readiness'

test('renders sub-tasks with a roll-up count when a story has them', () => {
  const items: BucketItem[] = [
    { title: 'ID Analyzer', subtasks: [
      { title: 'Structured extraction', status: 'Done' },
      { title: 'Provenance linking', status: '' },
      { title: 'Discrepancy detection', status: 'Working on it' },
    ] },
  ]
  render(<BucketColumn tone="amber" title="In Progress" items={items} />)
  expect(screen.getByText('1/3 done')).toBeInTheDocument()
  expect(screen.getByText('Structured extraction')).toBeInTheDocument()
  expect(screen.getByText('Provenance linking')).toBeInTheDocument()
})

test('renders no roll-up or sub-task list when a story has no sub-tasks', () => {
  const items: BucketItem[] = [{ title: 'Plain story' }]
  const { container } = render(<BucketColumn tone="green" title="Delivered" items={items} />)
  expect(screen.queryByText(/done$/)).not.toBeInTheDocument()
  expect(container.querySelector('.subtasks')).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/BucketColumn.test.tsx`
Expected: FAIL — no `1/3 done` text, no `.subtasks` rendering yet.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/BucketColumn.tsx` with:

```tsx
import type { BucketItem } from '../../shared/readiness'
import { subtaskStatus } from '../lib/subtaskStatus'

type Tone = 'green' | 'amber' | 'grey' | 'red'

export function BucketColumn({ tone, title, count, items }: {
  tone: Tone
  title: string
  count?: string
  items: BucketItem[]
}) {
  return (
    <div className={`bucket ${tone}`}>
      <div className="bhead">
        <span className="ico" />
        <span className="ttl">{title}</span>
      </div>
      {count != null && <div className="bcount">{count}</div>}
      {items.map((it, i) => {
        const subs = it.subtasks ?? []
        const doneCount = subs.filter((s) => subtaskStatus(s.status).done).length
        return (
          <div className="item" key={i}>
            <b>
              {it.title}
              {it.weight != null && <span className="wt">{it.weight}%</span>}
              {subs.length > 0 && <span className="subroll">{doneCount}/{subs.length} done</span>}
            </b>
            {it.detail ? ` ${it.detail}` : ''}
            {subs.length > 0 && (
              <ul className="subtasks">
                {subs.map((s, j) => (
                  <li className="subtask" key={j}>
                    <span className={`sdot ${subtaskStatus(s.status).tone}`} />
                    {s.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

Append to `src/styles/app.css` (keep the file's 2-space indentation; place after the `.wt` block near the existing bucket styles):

```css
  .subroll { display: inline-block; font-size: 11px; font-weight: 700; color: #3F5874; background: #EEF3F9;
    border-radius: 6px; padding: 1px 7px; margin-left: 6px; }
  .subtasks { list-style: none; margin: 8px 0 0; padding: 0; }
  .subtask { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #41566F; font-weight: 400; margin-top: 5px; }
  .subtask .sdot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; }
  .sdot.green { background: #2E9E6B; } .sdot.amber { background: #F0A93B; }
  .sdot.grey { background: #9AAEC6; } .sdot.red { background: #D84C4C; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/BucketColumn.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BucketColumn.tsx src/components/BucketColumn.test.tsx src/styles/app.css
git commit -m "Render nested sub-tasks with status dots and a done roll-up

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV"
```

---

### Task 6: Full verification + ledger + finish

**Files:**
- Modify: `docs/superpowers/reports/sdd-progress-ledger.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all files, including `api/import-extensions.test.ts` (the new `./config.js` import in `monday.ts` satisfies the extension rule) and `src/styles/styles.test.ts`.

- [ ] **Step 2: Typecheck + build**

Run: `npm run build`
Expected: `tsc -b` clean (no type errors from the new `subtasks?`/`SubTask`/`RawSubtask` types) and `vite build` succeeds.

- [ ] **Step 3: Drive the change end-to-end (verify skill)**

Invoke the `verify` skill (or the project run skill) to confirm a module whose board has sub-tasks (e.g. ID Analyzer / Underwriting) renders the nested list with dots + `X/Y done` in the actual app. If a live Monday fetch is not available locally, verify by rendering `BucketColumn`/`DeliveryPanel` with a fixture that includes `subtasks`, and record that the live check is pending.

- [ ] **Step 4: Update the SDD ledger**

Add a dated row to `docs/superpowers/reports/sdd-progress-ledger.md` recording this feature (branch `feature/monday-subtasks-visibility`, spec + plan paths, display-only scope), matching the format of the existing entries.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/reports/sdd-progress-ledger.md
git commit -m "Record Monday sub-tasks visibility in the SDD ledger

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV"
```

- [ ] **Step 6: Finish the branch**

Invoke `superpowers:finishing-a-development-branch`. Capped to push + PR + handoff: do NOT merge to `develop`/`main` without explicit user confirmation (per the project's git-workflow overrides, `main` always needs an explicit OK).

---

## Self-Review

**Spec coverage:**
- Fetch layer (query + `RawStory.subtasks` + `toStory`, both queries) → Task 2. ✓
- Config `SUBITEM_STATUS_COLUMN_ID` + `cleanSubtaskTitle` (hyphenated-code regex) → Task 1. ✓
- Data model `SubTask` + `BucketItem.subtasks` (semantic, no color) → Task 3. ✓
- Rollup attach + display-only invariant test → Task 3. ✓
- Front-end `subtaskStatus.ts` + `BucketColumn` render + CSS → Tasks 4, 5. ✓
- Renders in any bucket where sub-tasks exist (no bucket gating in `BucketColumn`) → Task 5. ✓
- Error handling: null sub-items → `[]` (Task 2 `toStory`), unset status → `''` → grey dot not done (Tasks 2/4). ✓
- Testing matrix (monday/rollup/subtaskStatus/BucketColumn) → Tasks 2–5. ✓
- `DeliveryPanel` and `refresh.ts` unchanged → not in any task's file list. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `RawSubtask { name, status }` (raw, Task 2) vs `SubTask { title, status }` (payload, Task 3) are distinct by design — rollup maps `name`→cleaned `title`. `subtaskStatus(status: string)` consumed consistently in Task 5. `RawStory.subtasks?` optional throughout; `toStory` always emits an array. ✓
