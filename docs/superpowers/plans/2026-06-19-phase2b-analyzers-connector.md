# Phase 2B — Analyzer modules live from the Analyzers board: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `bank`, `id`, `tax` to live data from the "Workstream: Analyzers" Monday board (`18403908550`) via a new single-select "Module" column, behind the unchanged `GET /api/readiness` contract, converting `bank` from a measurement module to a delivery module.

**Architecture:** Reuse the Phase 2a seam. The cron `/api/refresh` fetches two boards — Stories (→ `pe`/`vt`/`uw`/`lexi`) and Analyzers (→ `bank`/`id`/`tax`) — assembles one payload and writes the Blob; the request path is untouched. The analyzer rollup reuses the existing per-module logic; `bank`/`id`/`tax` compute live (no longer force-assumed), with a zero-coverage baseline fallback.

**Tech Stack:** TypeScript, Vercel Functions (`@vercel/node`), Vite + React (SPA), Vitest, `@vercel/blob`, Monday GraphQL API.

## Global Constraints

- Code, identifiers, and comments in English; commit messages in English. Spec/design context lives in `docs/superpowers/specs/2026-06-19-phase2b-analyzers-connector-design.md`.
- Do not add comments unless they explain a non-obvious *why* (one line max).
- ESM relative imports inside `api/` carry explicit `.js` extensions (existing regression guard, enforced by `api/import-extensions.test.ts`).
- Monday/server secrets are server-side only — never `VITE_*`, never imported by the frontend; `api/_lib/*` stays server-only.
- Module order is always `[pe, vt, uw, lexi, bank, id, tax]`.
- Status → bucket mapping (exact): `Done → delivered`; `Working on it`/`In Progress`/`Code Review`/`QA → inProgress`; `Stuck`/`Not Started`/`Ready to start`/`(blank)`/unknown `→ remaining`.
- Module-column labels on the Analyzers board are exactly `Bank` → `bank`, `ID` → `id`, `Tax` → `tax` (no `Shared`).
- `FORCE_ASSUMED` ends as `{ vt }` only.
- Commit after each task on the current `feature/*` branch (never on `develop`/`main`). The implementer writes and runs the tests.
- After every task, the full suite (`npx tsc -b && npx vitest run`) must be green.

---

### Task 1: Convert `bank` to a delivery module and remove the measurement code

**Files:**
- Modify: `shared/readiness.ts` (the `bank` object, `Module` union, remove `Metric`/`MeasurementModule`)
- Modify: `shared/readiness.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Delete: `src/components/MeasurementPanel.tsx`, `src/components/MeasurementPanel.test.tsx`, `src/components/MetricsTable.tsx`, `src/components/MetricsTable.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Module = DeliveryModule` (the measurement branch is gone). `MODULES_BY_KEY['bank']` is a `DeliveryModule` with `assumed: true`, `percent: 77`, `assumedLabel: 'Awaiting board data'`. `DeliveryPanel` renders every module.

- [ ] **Step 1: Update the shared contract tests to expect a delivery `bank` (red)**

In `shared/readiness.test.ts`, replace the measurement test and fix the assumed-set expectation. The file becomes:

```ts
import { MODULES, buildPayload } from './readiness'

test('exposes seven modules in PoC tab order', () => {
  expect(MODULES.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'tax'])
})

test('flags exactly the assumed modules', () => {
  const assumed = MODULES.filter((m) => m.assumed).map((m) => m.key)
  expect(assumed.sort()).toEqual(['bank', 'id', 'tax', 'vt'])
})

test('bank is a delivery module', () => {
  const bank = MODULES.find((m) => m.key === 'bank')!
  expect(bank.phase).toBe('delivery')
})

test('buildPayload stamps asOf and returns the modules', () => {
  const p = buildPayload('2026-06-17T14:00:00Z')
  expect(p.asOf).toBe('2026-06-17T14:00:00Z')
  expect(p.modules).toBe(MODULES)
})
```

- [ ] **Step 2: Run the shared test to verify it fails**

Run: `npx vitest run shared/readiness.test.ts`
Expected: FAIL — `bank is a delivery module` fails (`bank.phase` is `'measurement'`).

- [ ] **Step 3: Convert `bank` and collapse the union in `shared/readiness.ts`**

Remove the `Metric` interface and the `MeasurementModule` interface. Change the union to `export type Module = DeliveryModule`. Replace the `const bank: MeasurementModule = {...}` block with:

```ts
const bank: DeliveryModule = {
  key: 'bank',
  name: 'Bank Statement Analyzer',
  sub: 'Document-extraction analyzer. Build progress from the Analyzers workstream.',
  phase: 'delivery',
  percent: 77,
  status: 'on_track',
  statusLabel: 'On track',
  note: 'Figures assumed until the Analyzers board is tagged.',
  targetDate: '~6 July',
  dateConfidence: 'projected',
  assumed: true,
  assumedLabel: 'Awaiting board data',
  counts: { delivered: 0, inProgress: 0, remaining: 0 },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}
```

Leave `ReadinessPayload`, `Status`, `DateConfidence`, `BucketItem`, `DeliveryModule`, `MODULES`, `MODULES_BY_KEY`, and `buildPayload` as they are (order unchanged).

- [ ] **Step 4: Remove the measurement renderers and update `App.tsx`**

Delete the four measurement files:

```bash
git rm src/components/MeasurementPanel.tsx src/components/MeasurementPanel.test.tsx src/components/MetricsTable.tsx src/components/MetricsTable.test.tsx
```

Rewrite `src/App.tsx` to drop the `phase` discriminator (note the changed import and the removed `renderPanel`):

```tsx
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { ReadinessPayload } from '../shared/readiness'
import { fetchReadiness } from './api'
import { Masthead } from './components/Masthead'
import { Tabs } from './components/Tabs'
import { DeliveryPanel } from './components/DeliveryPanel'

export default function App() {
  const { getToken } = useAuth()
  const [payload, setPayload] = useState<ReadinessPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadiness(getToken, ctrl.signal)
      .then((p) => {
        setPayload(p)
        setActiveKey(p.modules[0]?.key ?? null)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => ctrl.abort()
  }, [getToken])

  if (error) {
    return <div className="wrap"><div className="card">Could not load the console: {error}</div></div>
  }
  if (!payload || !activeKey) {
    return <div className="wrap"><div className="card">Loading…</div></div>
  }

  const active = payload.modules.find((m) => m.key === activeKey)!
  return (
    <div className="wrap">
      <Masthead asOf={payload.asOf} />
      <Tabs modules={payload.modules} activeKey={activeKey} onSelect={setActiveKey} />
      <DeliveryPanel module={active} />
    </div>
  )
}
```

- [ ] **Step 5: Update the App tab-switch test for a delivery `bank`**

In `src/App.test.tsx`, replace the first test (the second test, the error card, is unchanged):

```tsx
test('renders the first module after load and switches tabs', async () => {
  render(<App />)
  // 2 = the active tab button plus the rendered panel's mtitle
  await waitFor(() => expect(screen.getAllByText('Pricing & Eligibility')).toHaveLength(2))
  await userEvent.click(screen.getByRole('tab', { name: /Bank Statement Analyzer/ }))
  await waitFor(() => expect(screen.getAllByText('Bank Statement Analyzer')).toHaveLength(2))
})
```

- [ ] **Step 6: Run typecheck and the full suite to verify green**

Run: `npx tsc -b && npx vitest run`
Expected: PASS — no references to `MeasurementModule`/`Metric`/`MeasurementPanel`/`MetricsTable` remain; `bank` renders via `DeliveryPanel`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Convert bank to a delivery module and remove the measurement code"
```

---

### Task 2: Generalize the Monday connector for the Analyzers board

**Files:**
- Modify: `api/_lib/monday.ts`
- Modify: `api/_lib/monday.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `fetchBoardStories(opts)` where `opts` gains `statusColumnId?: string` (default `'task_status'`) and `moduleColumnId?: string` is now optional. When `moduleColumnId` is empty/absent, the requested columns omit it and `RawStory.module` is `null`. Existing call shape (`{ token, boardId, moduleColumnId }`) is unchanged.

- [ ] **Step 1: Write the failing test for the Analyzers-board column shape**

Add to `api/_lib/monday.test.ts`:

```ts
test('reads a custom status column and omits the module column when absent', async () => {
  const page = { boards: [{ items_page: { cursor: null, items: [
    { name: 'Implement Bank Statement Analyzer', column_values: [
      { id: 'status', text: 'Not Started' },
    ] },
  ] } }] }
  const fetchImpl = vi.fn().mockResolvedValueOnce(jsonRes(page))

  const stories = await fetchBoardStories({
    token: 't', boardId: 7, statusColumnId: 'status',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })

  const sentBody = JSON.parse((fetchImpl.mock.calls[0][1] as { body: string }).body) as { query: string }
  expect(sentBody.query).toContain('ids: ["status"]')
  expect(stories).toEqual([
    { name: 'Implement Bank Statement Analyzer', status: 'Not Started', module: null },
  ])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/monday.test.ts -t "custom status column"`
Expected: FAIL — `module` is read from `task_status`/the hardcoded columns; the query string still contains `task_status`.

- [ ] **Step 3: Generalize `fetchBoardStories`**

In `api/_lib/monday.ts`, replace `toStory` and the `fetchBoardStories` signature/column build:

```ts
function toStory(item: MondayItem, statusColumnId: string, moduleColumnId?: string): RawStory {
  const textOf = (id: string) => item.column_values.find((c) => c.id === id)?.text ?? null
  return {
    name: item.name,
    status: textOf(statusColumnId) ?? '',
    module: moduleColumnId ? textOf(moduleColumnId) : null,
  }
}

export async function fetchBoardStories(opts: {
  token: string
  boardId: number
  statusColumnId?: string
  moduleColumnId?: string
  pageLimit?: number
  fetchImpl?: typeof fetch
}): Promise<RawStory[]> {
  const { token, boardId, statusColumnId = 'task_status', moduleColumnId, pageLimit = 100, fetchImpl = fetch } = opts
  const cols = JSON.stringify(moduleColumnId ? [statusColumnId, moduleColumnId] : [statusColumnId])
  const out: RawStory[] = []

  const firstData = await mondayRequest(
    fetchImpl,
    token,
    `query { boards(ids: ${boardId}) { items_page(limit: ${pageLimit}) { cursor items { name column_values(ids: ${cols}) { id text } } } } }`,
  )
  const firstBoard = (firstData.boards as Array<{ items_page: ItemsPage }>)[0]
  if (!firstBoard) throw new Error(`Monday board ${boardId} not found`)
  let page = firstBoard.items_page
  out.push(...page.items.map((i) => toStory(i, statusColumnId, moduleColumnId)))

  while (page.cursor) {
    const nextData = await mondayRequest(
      fetchImpl,
      token,
      `query { next_items_page(limit: ${pageLimit}, cursor: "${page.cursor}") { cursor items { name column_values(ids: ${cols}) { id text } } } }`,
    )
    if (!nextData.next_items_page) throw new Error('Monday API: missing next_items_page in paginated response')
    page = nextData.next_items_page as ItemsPage
    out.push(...page.items.map((i) => toStory(i, statusColumnId, moduleColumnId)))
  }

  return out
}
```

- [ ] **Step 4: Run the connector tests to verify green**

Run: `npx vitest run api/_lib/monday.test.ts`
Expected: PASS — the new test passes and the existing pagination/error tests (which pass `moduleColumnId` and default `statusColumnId` to `task_status`) still pass.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/monday.ts api/_lib/monday.test.ts
git commit -m "Generalize fetchBoardStories with statusColumnId and optional moduleColumnId"
```

---

### Task 3: Add Analyzers-board config (board id, column getter, labels, statuses, keys)

**Files:**
- Modify: `api/_lib/config.ts`
- Modify: `api/_lib/config.test.ts`

**Interfaces:**
- Consumes: `ModuleKey` (existing).
- Produces: `ANALYZER_BOARD_ID = 18403908550`; `getAnalyzerBoardId(): number` (reads `ID_MONDAY_ANALYZERS`, falls back to `ANALYZER_BOARD_ID`); `getAnalyzerColumnId(): string` (reads `MONDAY_ANALYZER_COLUMN_ID`, default `''`); `ANALYZER_KEYS: readonly ModuleKey[] = ['bank', 'id', 'tax']`; `STATUS_BUCKET` recognizes `'Working on it'`/`'Not Started'`; `moduleKeyForLabel` recognizes `'Bank'`/`'ID'`/`'Tax'`.

This task is purely additive — `DELIVERY_KEYS` and `FORCE_ASSUMED` are NOT changed here (that is Task 4).

- [ ] **Step 1: Write the failing tests for the new config**

Add to `api/_lib/config.test.ts` (and extend its import to include `ANALYZER_KEYS`, `getAnalyzerBoardId`, `getAnalyzerColumnId`, `ANALYZER_BOARD_ID`):

```ts
test('maps the Analyzers-board statuses to buckets', () => {
  expect(bucketForStatus('Working on it')).toBe('inProgress')
  expect(bucketForStatus('Not Started')).toBe('remaining')
})

test('maps the Analyzers Module labels to keys', () => {
  expect(moduleKeyForLabel('Bank')).toBe('bank')
  expect(moduleKeyForLabel('ID')).toBe('id')
  expect(moduleKeyForLabel('Tax')).toBe('tax')
})

test('ANALYZER_KEYS are bank/id/tax', () => {
  expect(ANALYZER_KEYS).toEqual(['bank', 'id', 'tax'])
})

test('getAnalyzerBoardId returns ANALYZER_BOARD_ID for unset/invalid; parses valid ids', () => {
  const orig = process.env.ID_MONDAY_ANALYZERS
  delete process.env.ID_MONDAY_ANALYZERS
  expect(getAnalyzerBoardId()).toBe(ANALYZER_BOARD_ID)
  process.env.ID_MONDAY_ANALYZERS = '12345'
  expect(getAnalyzerBoardId()).toBe(12345)
  process.env.ID_MONDAY_ANALYZERS = orig
})

test('getAnalyzerColumnId returns empty string when unset', () => {
  const orig = process.env.MONDAY_ANALYZER_COLUMN_ID
  delete process.env.MONDAY_ANALYZER_COLUMN_ID
  expect(getAnalyzerColumnId()).toBe('')
  process.env.MONDAY_ANALYZER_COLUMN_ID = 'color_x'
  expect(getAnalyzerColumnId()).toBe('color_x')
  process.env.MONDAY_ANALYZER_COLUMN_ID = orig
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/_lib/config.test.ts -t "Analyzers"`
Expected: FAIL — `ANALYZER_KEYS`/`getAnalyzerBoardId`/`getAnalyzerColumnId` are not exported; `'Working on it'`/`'Bank'` are unmapped.

- [ ] **Step 3: Add the config**

In `api/_lib/config.ts`:

Add `'Working on it'` and `'Not Started'` to `STATUS_BUCKET`:

```ts
export const STATUS_BUCKET: Record<string, Bucket> = {
  Done: 'delivered',
  'In Progress': 'inProgress',
  'Working on it': 'inProgress',
  'Code Review': 'inProgress',
  QA: 'inProgress',
  'Ready to start': 'remaining',
  'Not Started': 'remaining',
  Stuck: 'remaining',
  '': 'remaining',
}
```

Add the Analyzers labels to `MODULE_LABELS`:

```ts
export const MODULE_LABELS: Record<string, ModuleKey> = {
  'Pricing and Eligibility': 'pe',
  'Verified Truth': 'vt',
  Underwriting: 'uw',
  'Lexi Intelligence': 'lexi',
  'ID Analyzer': 'id',
  'Tax Analyzer': 'tax',
  'Bank Analyzer': 'bank',
  Bank: 'bank',
  ID: 'id',
  Tax: 'tax',
}
```

Add `ANALYZER_KEYS` next to `DELIVERY_KEYS` (leave `DELIVERY_KEYS` as-is for now):

```ts
export const ANALYZER_KEYS: readonly ModuleKey[] = ['bank', 'id', 'tax']
```

Add the board id constant and getters (near `getBoardId`):

```ts
export const ANALYZER_BOARD_ID = 18403908550

export function getAnalyzerBoardId(): number {
  const n = Number(process.env.ID_MONDAY_ANALYZERS)
  return Number.isFinite(n) && n > 0 ? n : ANALYZER_BOARD_ID
}

export function getAnalyzerColumnId(): string {
  return process.env.MONDAY_ANALYZER_COLUMN_ID ?? ''
}
```

- [ ] **Step 4: Run config tests and the full suite**

Run: `npx vitest run api/_lib/config.test.ts && npx tsc -b`
Expected: PASS — new tests pass; existing config tests (incl. the still-unchanged `DELIVERY_KEYS`/`FORCE_ASSUMED` tests) pass; nothing else broke.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/config.ts api/_lib/config.test.ts
git commit -m "Add Analyzers-board config: board id, column getter, labels, statuses, keys"
```

---

### Task 4: Route the Analyzers board through the rollup and cron

**Files:**
- Modify: `api/_lib/config.ts` (flip `DELIVERY_KEYS` and `FORCE_ASSUMED`)
- Modify: `api/_lib/config.test.ts`
- Modify: `api/_lib/rollup.ts`
- Modify: `api/_lib/rollup.test.ts`
- Modify: `api/refresh.ts`
- Modify: `api/refresh.test.ts`

**Interfaces:**
- Consumes: `ANALYZER_KEYS`, `getAnalyzerBoardId`, `getAnalyzerColumnId` (Task 3); `fetchBoardStories` with `statusColumnId` (Task 2); `MODULES_BY_KEY['bank']` as a `DeliveryModule` (Task 1).
- Produces: `buildAnalyzerModules(stories: RawStory[]): Record<string, DeliveryModule>` (keys `bank`/`id`/`tax`); `assembleLivePayload(storyStories: RawStory[], analyzerStories: RawStory[], now: string): ReadinessPayload`. `DELIVERY_KEYS = ['pe','vt','uw','lexi']`; `FORCE_ASSUMED = { vt }`.

- [ ] **Step 1: Update the config tests for the flipped keys (red)**

In `api/_lib/config.test.ts`, replace the two existing tests:

```ts
test('DELIVERY_KEYS are the Stories-board modules', () => {
  expect(DELIVERY_KEYS).toEqual(['pe', 'vt', 'uw', 'lexi'])
})

test('FORCE_ASSUMED holds vt only', () => {
  expect([...FORCE_ASSUMED]).toEqual(['vt'])
})
```

- [ ] **Step 2: Update the rollup tests for the analyzer path (red)**

In `api/_lib/rollup.test.ts`, update the import to add `buildAnalyzerModules`, change the two `assembleLivePayload` tests to the two-board signature, and add the analyzer-rollup tests. The relevant tests become:

```ts
import { assembleLivePayload, buildAnalyzerModules, buildDeliveryModule } from './rollup'

test('assembleLivePayload returns 7 modules in PoC order, source live', () => {
  const p = assembleLivePayload([], [], '2026-06-18T00:00:00Z')
  expect(p.modules.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'tax'])
  expect(p.source).toBe('live')
  expect(p.builtAt).toBe('2026-06-18T00:00:00Z')
  expect(p.asOf).toBe('2026-06-18T00:00:00Z')
})

test('analyzer-labeled stories on the Stories board are ignored by the delivery rollup', () => {
  const stories: RawStory[] = [
    { name: 'U-02-01 · Bank Statement Analyzer', status: 'Done', module: 'Bank Analyzer' },
  ]
  const p = assembleLivePayload(stories, [], 'now')
  expect(p.modules.find((m) => m.key === 'bank')!.assumed).toBe(true)
})

test('buildAnalyzerModules routes Bank/ID/Tax labels and computes live', () => {
  const stories: RawStory[] = [
    { name: 'Implement Bank Statement Analyzer', status: 'Done', module: 'Bank' },
    { name: 'Add AI usage tracking', status: 'Working on it', module: 'Bank' },
    { name: 'Implement ID Document Analyzer', status: 'Not Started', module: 'ID' },
  ]
  const a = buildAnalyzerModules(stories)
  expect(a.bank.assumed).toBe(false)
  expect(a.bank.counts).toEqual({ delivered: 1, inProgress: 1, remaining: 0 })
  expect(a.bank.percent).toBe(50)
  expect(a.id.assumed).toBe(false)
  expect(a.id.counts).toEqual({ delivered: 0, inProgress: 0, remaining: 1 })
  expect(a.id.percent).toBe(0)
  expect(a.tax.assumed).toBe(true)
})

test('buildAnalyzerModules excludes unmapped and null-label items', () => {
  const stories: RawStory[] = [
    { name: 'Implement Credit Report Analyzer', status: 'Done', module: 'Credit Report' },
    { name: 'Item 4', status: '', module: null },
  ]
  const a = buildAnalyzerModules(stories)
  expect(a.bank.assumed).toBe(true)
  expect(a.id.assumed).toBe(true)
  expect(a.tax.assumed).toBe(true)
})
```

Leave the unchanged tests (`rolls up counts...`, `a module with no stories falls back...`, `zero-stories assumed...`, `force-assumed modules stay assumed...`, `assembleLivePayload routes a real Module label...`) in place. The `assembleLivePayload routes a real Module label to its delivery module` test calls `assembleLivePayload(stories, '...')` with two args — update it to `assembleLivePayload(stories, [], '2026-06-18T00:00:00Z')`.

- [ ] **Step 3: Run to verify the rollup/config tests fail**

Run: `npx vitest run api/_lib/rollup.test.ts api/_lib/config.test.ts`
Expected: FAIL — `buildAnalyzerModules` is undefined; `assembleLivePayload` arity mismatch; `DELIVERY_KEYS`/`FORCE_ASSUMED` still hold the old values.

- [ ] **Step 4: Flip the config keys**

In `api/_lib/config.ts`:

```ts
export const DELIVERY_KEYS: readonly ModuleKey[] = ['pe', 'vt', 'uw', 'lexi']
```

```ts
export const FORCE_ASSUMED: ReadonlySet<ModuleKey> = new Set<ModuleKey>(['vt'])
```

- [ ] **Step 5: Add the analyzer rollup and two-board assembly**

In `api/_lib/rollup.ts`, add `ANALYZER_KEYS` to the config import, factor the grouping into one helper, and change `assembleLivePayload`. `buildDeliveryModule` is unchanged. The lower half of the file becomes:

```ts
function buildModulesForKeys(stories: RawStory[], keys: readonly ModuleKey[]): Record<string, DeliveryModule> {
  const byKey: Record<string, RawStory[]> = {}
  for (const k of keys) byKey[k] = []
  for (const s of stories) {
    const key = moduleKeyForLabel(s.module)
    if (key && byKey[key]) byKey[key].push(s)
  }
  const result: Record<string, DeliveryModule> = {}
  for (const k of keys) result[k] = buildDeliveryModule(k, byKey[k])
  return result
}

export function buildDeliveryModules(stories: RawStory[]): Record<string, DeliveryModule> {
  return buildModulesForKeys(stories, DELIVERY_KEYS)
}

export function buildAnalyzerModules(stories: RawStory[]): Record<string, DeliveryModule> {
  return buildModulesForKeys(stories, ANALYZER_KEYS)
}

export function assembleLivePayload(
  storyStories: RawStory[],
  analyzerStories: RawStory[],
  now: string,
): ReadinessPayload {
  const d = buildDeliveryModules(storyStories)
  const a = buildAnalyzerModules(analyzerStories)
  const modules: Module[] = [d.pe, d.vt, d.uw, d.lexi, a.bank, a.id, a.tax]
  return { asOf: now, builtAt: now, source: 'live', modules }
}
```

Update the config import line at the top of `api/_lib/rollup.ts` to include `ANALYZER_KEYS`:

```ts
import {
  ANALYZER_KEYS,
  DELIVERY_KEYS,
  FORCE_ASSUMED,
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  statusFromPercent,
  STATUS_LABELS,
  type ModuleKey,
} from './config.js'
```

- [ ] **Step 6: Fetch both boards in the cron**

Replace `api/refresh.ts` with:

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchBoardStories } from './_lib/monday.js'
import { assembleLivePayload } from './_lib/rollup.js'
import { writeLatest } from './_lib/blob.js'
import {
  getAnalyzerBoardId,
  getAnalyzerColumnId,
  getBoardId,
  getCronSecret,
  getModuleColumnId,
  getMondayToken,
} from './_lib/config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${getCronSecret()}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const token = getMondayToken()
    const [storyStories, analyzerStories] = await Promise.all([
      fetchBoardStories({ token, boardId: getBoardId(), moduleColumnId: getModuleColumnId() }),
      fetchBoardStories({ token, boardId: getAnalyzerBoardId(), statusColumnId: 'status', moduleColumnId: getAnalyzerColumnId() }),
    ])
    const payload = assembleLivePayload(storyStories, analyzerStories, new Date().toISOString())
    await writeLatest(payload)
    return res.status(200).json({ ok: true, modules: payload.modules.length, builtAt: payload.builtAt })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
```

- [ ] **Step 7: Update the refresh test for the two-board fetch**

In `api/refresh.test.ts`, add `process.env.ID_MONDAY_ANALYZERS = '18403908550'` to `beforeEach`, and replace the success test to assert both boards are fetched:

```ts
test('fetches both boards, assembles, writes the blob, and returns 200', async () => {
  vi.mocked(fetchBoardStories).mockResolvedValue([
    { name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility' },
  ])
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  expect(fetchBoardStories).toHaveBeenCalledTimes(2)
  const boardIds = vi.mocked(fetchBoardStories).mock.calls.map((c) => c[0].boardId)
  expect(boardIds).toContain(18403908550)
  expect(writeLatest).toHaveBeenCalledTimes(1)
})
```

The 401 test and the `on a Monday failure returns 500 and does NOT overwrite the blob` test are unchanged (with `Promise.all`, a rejected fetch still yields 500 and no write).

- [ ] **Step 8: Run the affected tests, then the full suite**

Run: `npx vitest run api/_lib/rollup.test.ts api/_lib/config.test.ts api/refresh.test.ts && npx tsc -b && npx vitest run`
Expected: PASS — analyzer rollup, flipped config, two-board cron all green; full suite green.

- [ ] **Step 9: Commit**

```bash
git add api/_lib/config.ts api/_lib/config.test.ts api/_lib/rollup.ts api/_lib/rollup.test.ts api/refresh.ts api/refresh.test.ts
git commit -m "Route the Analyzers board through the rollup and refresh cron"
```

---

### Task 5: Document the new env var and drop the Metrics board var

**Files:**
- Modify: `.env.example`
- External: Vercel project env (remove `ID_MONDAY_METRICS` from Production + Preview)

**Interfaces:**
- Consumes: `getAnalyzerColumnId()` reads `MONDAY_ANALYZER_COLUMN_ID` (Task 3).
- Produces: documented env contract; no `ID_MONDAY_METRICS` anywhere.

- [ ] **Step 1: Update `.env.example`**

Remove the two Metrics lines:

```
# Metrics board id
ID_MONDAY_METRICS=18418407276
```

Add, right after the `MONDAY_MODULE_COLUMN_ID=` line:

```
# id of the "Module" status column on the Analyzers board (set after the team creates it)
MONDAY_ANALYZER_COLUMN_ID=
```

- [ ] **Step 2: Verify no source/code reference to the dropped var remains**

Run: `grep -rn "ID_MONDAY_METRICS" . --exclude-dir=node_modules --exclude-dir=.git`
Expected: no matches in `.env.example`, `api/`, `src/`, or `shared/` (matches only in `docs/superpowers/specs/` history are fine).

- [ ] **Step 3: Remove `ID_MONDAY_METRICS` from Vercel (Production + Preview)**

Run:
```bash
npx vercel env rm ID_MONDAY_METRICS production --yes
npx vercel env rm ID_MONDAY_METRICS preview --yes
npx vercel env ls
```
Expected: `ID_MONDAY_METRICS` no longer listed; `ID_MONDAY_ANALYZERS` remains.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "Document MONDAY_ANALYZER_COLUMN_ID and drop the Metrics board env var"
```

---

## Post-implementation (external, not code)

These gate **live numbers**, not the merge. Track separately:

1. The team creates the single-select status column **"Module"** on board `18403908550` with labels exactly `Bank`, `ID`, `Tax`, and tags every item with the analyzer it serves (out-of-console work like Credit Report → empty).
2. Arturo sets `MONDAY_ANALYZER_COLUMN_ID` (the new column's id) in Vercel Production + Preview.
3. Trigger `/api/refresh` (or wait for the cron); confirm `GET /api/readiness` shows `bank`/`id`/`tax` computing live (low percentages while items are `Not Started`). Until the env var is set, the three modules serve their zero-coverage baselines — no breakage.

## Self-Review

**Spec coverage:**
- §5 connector generalization → Task 2. ✓
- §6 rollup (`buildAnalyzerModules`, two-board `assembleLivePayload`, shared helper) → Task 4. ✓
- §7 `bank` → `DeliveryModule`, remove `Metric`/`MeasurementModule` → Task 1. ✓
- §8 frontend (drop `phase` branch, remove `MeasurementPanel`/`MetricsTable`) → Task 1. ✓
- §9 config (board id/column getters, `STATUS_BUCKET`, `MODULE_LABELS`, key sets, `FORCE_ASSUMED`) → Tasks 3 + 4. ✓
- §10 data flow (two-board cron, fail → no overwrite) → Task 4. ✓
- §11 testing (rollup/connector/refresh/readiness/App; remove measurement tests) → Tasks 1–4. ✓
- §12 env (`MONDAY_ANALYZER_COLUMN_ID` added, `ID_MONDAY_METRICS` removed) → Task 5. ✓
- §4.5 assumed policy (drop force-assumed for bank/id/tax; zero-coverage guard) → Tasks 1 (baseline) + 4 (`FORCE_ASSUMED={vt}`). ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code and exact commands. ✓

**Type consistency:** `fetchBoardStories` opts (`statusColumnId?`, `moduleColumnId?`) consistent across Tasks 2/4. `assembleLivePayload(storyStories, analyzerStories, now)` consistent across rollup (Task 4), its test (Task 4), and `refresh.ts` (Task 4). `buildAnalyzerModules` returns `Record<string, DeliveryModule>` keyed `bank`/`id`/`tax`, consumed by `assembleLivePayload`. `Module = DeliveryModule` (Task 1) makes `MODULES_BY_KEY['bank']` a valid `DeliveryModule` base for `buildDeliveryModule`. ✓
