# Phase 2a — Live Monday Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static delivery-module numbers in `GET /api/readiness` with values rolled up live from the Monday Stories board, behind the unchanged payload contract.

**Architecture:** A Vercel Cron hits a guarded `/api/refresh` that fetches the board over GraphQL, rolls stories up per module (keyed on a new board "Module" column), assembles a `ReadinessPayload`, and writes it to Vercel Blob (last-known-good). `GET /api/readiness` only reads the Blob (falling back to the config baseline when the Blob is missing). The Bank Analyzer (measurement) stays on its fixture; modules with no tagged stories stay `assumed`.

**Tech Stack:** TypeScript, `@vercel/node` functions, `@vercel/blob`, Monday GraphQL API v2, Vitest. Spec: `docs/superpowers/specs/2026-06-18-phase2-monday-connector-design.md`.

## Global Constraints

- Language: code, identifiers, comments, commit messages in **English**. No code comments unless they explain a non-obvious *why* (one line max).
- The frontend stays a dumb renderer. **Do not change the discriminated-union shape or any per-module field.** Contract changes are **additive optional fields only** (`source?`, `builtAt?`).
- **ESM extensions:** every relative import inside `api/` (between `api/_lib/` files and to `shared/`) MUST carry an explicit `.js` extension. Enforced by `api/import-extensions.test.ts`. (Test files are exempt and import without `.js`, matching the existing test style.)
- Server-only connector code lives under `api/_lib/`. The frontend never imports it. `MONDAY_API_TOKEN` and `CRON_SECRET` are server-side env only — never a `VITE_*` var, never committed.
- Module mapping is via the board **"Module" column only** (referenced by `MONDAY_MODULE_COLUMN_ID`). No name-prefix or epic parsing.
- Rollup is by **story count**, not story points.
- Tests must never deploy (`.vercelignore` excludes `*.test.ts` / `*.test.tsx`).
- Board id `18402839374`; status→bucket and thresholds per the spec (§6–7).
- TDD: red → green → refactor. Commit after each green task. Work only on branch `feature/phase2-monday-connector`; never commit to `develop`/`main`.
- Run the full suite with `npx vitest run`; a single file with `npx vitest run <path>`.

## File Structure

```
api/
  readiness.ts                 # MODIFY (Task 6): read Blob → payload; Blob missing → baseline
  refresh.ts                   # CREATE (Task 5): cron target, guarded; rebuild → write Blob
  import-extensions.test.ts    # CREATE (Task 1): walks api/ asserting relative imports carry .js
  _lib/
    config.ts                  # CREATE (Task 1): STATUS_BUCKET, thresholds, label maps, cleanTitle, env readers
    monday.ts                  # CREATE (Task 2): GraphQL client + cursor pagination → RawStory[]
    rollup.ts                  # CREATE (Task 3): per-module rollup + assembleLivePayload
    blob.ts                    # CREATE (Task 4): readLatest / writeLatest (@vercel/blob)
shared/
  readiness.ts                 # MODIFY (Task 1): add source?/builtAt?, source:'baseline' in buildPayload, MODULES_BY_KEY
vercel.json                    # MODIFY (Task 7): add crons
package.json                   # MODIFY (Task 4): add @vercel/blob
.env.example                   # CREATE (Task 7): document env var names (no secrets)
```

---

### Task 1: Contract additions + connector config foundation

**Files:**
- Modify: `shared/readiness.ts`
- Create: `api/_lib/config.ts`
- Test: `api/_lib/config.test.ts`, `api/import-extensions.test.ts`

**Interfaces:**
- Consumes: `Status`, `Module`, `MODULES`, `buildPayload`, `ReadinessPayload` from `shared/readiness`.
- Produces: `ReadinessPayload` gains `source?: 'live' | 'baseline'` and `builtAt?: string`; `buildPayload` stamps `source: 'baseline'`; `MODULES_BY_KEY: Record<string, Module>`. From `api/_lib/config.ts`: type `ModuleKey`; type `Bucket`; `DELIVERY_KEYS: readonly ModuleKey[]`; `STATUS_BUCKET: Record<string, Bucket>`; `bucketForStatus(status): Bucket`; `MODULE_LABELS: Record<string, ModuleKey>`; `moduleKeyForLabel(label): ModuleKey | null`; `statusFromPercent(percent): Status`; `STATUS_LABELS: Record<Status, string>`; `cleanTitle(name): string`; `getMondayToken()`, `getModuleColumnId()`, `getBoardId()`, `getCronSecret()`.

- [ ] **Step 1: Add the optional freshness fields and the lookup map to `shared/readiness.ts`**

Change the `ReadinessPayload` interface (top of file):

```ts
export interface ReadinessPayload {
  asOf: string
  modules: Module[]
  source?: 'live' | 'baseline'
  builtAt?: string
}
```

Change `buildPayload`:

```ts
export function buildPayload(now: string): ReadinessPayload {
  return { asOf: now, modules: MODULES, source: 'baseline' }
}
```

Append at the very end of the file (after `export const MODULES`):

```ts
export const MODULES_BY_KEY: Record<string, Module> = Object.fromEntries(
  MODULES.map((m) => [m.key, m]),
)
```

- [ ] **Step 2: Run the existing shared test to confirm it still passes**

Run: `npx vitest run shared/readiness`
Expected: PASS (additive change; `p.modules === MODULES` and `asOf` assertions unaffected).

- [ ] **Step 3: Write the failing test `api/_lib/config.test.ts`**

```ts
import { expect, test } from 'vitest'
import {
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  statusFromPercent,
  DELIVERY_KEYS,
} from './config'

test('maps Monday statuses to buckets, unknown/blank → remaining', () => {
  expect(bucketForStatus('Done')).toBe('delivered')
  expect(bucketForStatus('In Progress')).toBe('inProgress')
  expect(bucketForStatus('Code Review')).toBe('inProgress')
  expect(bucketForStatus('QA')).toBe('inProgress')
  expect(bucketForStatus('Ready to start')).toBe('remaining')
  expect(bucketForStatus('Stuck')).toBe('remaining')
  expect(bucketForStatus('')).toBe('remaining')
  expect(bucketForStatus(null)).toBe('remaining')
  expect(bucketForStatus('Whatever')).toBe('remaining')
})

test('maps Module column labels to keys', () => {
  expect(moduleKeyForLabel('Pricing & Eligibility')).toBe('pe')
  expect(moduleKeyForLabel('ID Analyzer')).toBe('id')
  expect(moduleKeyForLabel(null)).toBeNull()
  expect(moduleKeyForLabel('Not a module')).toBeNull()
})

test('derives the status pill from percent thresholds', () => {
  expect(statusFromPercent(65)).toBe('on_track')
  expect(statusFromPercent(64)).toBe('in_progress')
  expect(statusFromPercent(40)).toBe('in_progress')
  expect(statusFromPercent(39)).toBe('early')
})

test('cleanTitle strips sprint and id prefixes but leaves plain titles', () => {
  expect(cleanTitle('S1 · F-Elig-03 · Eligibility results')).toBe('Eligibility results')
  expect(cleanTitle('F-01-06 · Eligibility evaluation')).toBe('Eligibility evaluation')
  expect(cleanTitle('L-GenUI-05 · Direct Agent Field Updates')).toBe('Direct Agent Field Updates')
  expect(cleanTitle('CLTV calculation issue')).toBe('CLTV calculation issue')
})

test('DELIVERY_KEYS excludes bank and is in PoC order', () => {
  expect(DELIVERY_KEYS).toEqual(['pe', 'vt', 'uw', 'lexi', 'id', 'tax'])
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run api/_lib/config`
Expected: FAIL ("Cannot find module './config'").

- [ ] **Step 5: Create `api/_lib/config.ts`**

```ts
import type { Status } from '../../shared/readiness.js'

export const BOARD_ID = 18402839374

export type ModuleKey = 'pe' | 'vt' | 'uw' | 'lexi' | 'bank' | 'id' | 'tax'

export const DELIVERY_KEYS: readonly ModuleKey[] = ['pe', 'vt', 'uw', 'lexi', 'id', 'tax']

export type Bucket = 'delivered' | 'inProgress' | 'remaining'

export const STATUS_BUCKET: Record<string, Bucket> = {
  Done: 'delivered',
  'In Progress': 'inProgress',
  'Code Review': 'inProgress',
  QA: 'inProgress',
  'Ready to start': 'remaining',
  Stuck: 'remaining',
  '': 'remaining',
}

export function bucketForStatus(status: string | null | undefined): Bucket {
  return STATUS_BUCKET[status ?? ''] ?? 'remaining'
}

export const MODULE_LABELS: Record<string, ModuleKey> = {
  'Pricing & Eligibility': 'pe',
  'Verified Truth': 'vt',
  Underwriting: 'uw',
  Lexi: 'lexi',
  'ID Analyzer': 'id',
  'Tax Docs': 'tax',
  'Bank Analyzer': 'bank',
}

export function moduleKeyForLabel(label: string | null | undefined): ModuleKey | null {
  if (!label) return null
  return MODULE_LABELS[label] ?? null
}

export function statusFromPercent(percent: number): Status {
  if (percent >= 65) return 'on_track'
  if (percent >= 40) return 'in_progress'
  return 'early'
}

export const STATUS_LABELS: Record<Status, string> = {
  on_track: 'On track',
  in_progress: 'In progress',
  early: 'Early build',
  at_risk: 'At risk',
  blocked: 'Blocked',
}

export function cleanTitle(name: string): string {
  return name
    .replace(/^S\d+\s*·\s*/, '')
    .replace(/^[A-Z]+-[\w-]+\s*·\s*/, '')
    .trim()
}

export function getMondayToken(): string {
  const t = process.env.MONDAY_API_TOKEN
  if (!t) throw new Error('MONDAY_API_TOKEN is not set')
  return t
}

export function getModuleColumnId(): string {
  const c = process.env.MONDAY_MODULE_COLUMN_ID
  if (!c) throw new Error('MONDAY_MODULE_COLUMN_ID is not set')
  return c
}

export function getBoardId(): number {
  return Number(process.env.ID_MONDAY) || BOARD_ID
}

export function getCronSecret(): string {
  const s = process.env.CRON_SECRET
  if (!s) throw new Error('CRON_SECRET is not set')
  return s
}
```

- [ ] **Step 6: Run the config test to verify it passes**

Run: `npx vitest run api/_lib/config`
Expected: PASS (5 tests).

- [ ] **Step 7: Write the generalized import-extension test `api/import-extensions.test.ts`**

This replaces the single-file import check (the old one in `api/readiness.test.ts` is removed in Task 6).

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'

const apiDir = dirname(fileURLToPath(import.meta.url))

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return tsFiles(full)
    if (full.endsWith('.ts') && !full.endsWith('.test.ts')) return [full]
    return []
  })
}

test('every relative import under api/ carries an explicit .js extension', () => {
  for (const file of tsFiles(apiDir)) {
    const src = readFileSync(file, 'utf8')
    const relativeImports = src.match(/from '(\.\.?\/[^']+)'/g) ?? []
    for (const imp of relativeImports) {
      expect(imp, `${file}: ${imp}`).toMatch(/\.js'$/)
    }
  }
})
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx vitest run api/import-extensions`
Expected: PASS (scans `api/readiness.ts` and `api/_lib/config.ts`; both use `.js`).

- [ ] **Step 9: Commit**

```bash
git add shared/readiness.ts api/_lib/config.ts api/_lib/config.test.ts api/import-extensions.test.ts
git commit -m "Add Phase 2a contract fields and connector config foundation"
```

---

### Task 2: Monday GraphQL client with cursor pagination

**Files:**
- Create: `api/_lib/monday.ts`
- Test: `api/_lib/monday.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks at runtime (token/board/column passed as args for testability).
- Produces: `interface RawStory { name: string; status: string; module: string | null }`; `fetchBoardStories(opts: { token: string; boardId: number; moduleColumnId: string; pageLimit?: number; fetchImpl?: typeof fetch }): Promise<RawStory[]>`.

- [ ] **Step 1: Write the failing test `api/_lib/monday.test.ts`**

```ts
import { expect, test, vi } from 'vitest'
import { fetchBoardStories } from './monday'

function jsonRes(data: unknown) {
  return { ok: true, json: () => Promise.resolve({ data }) }
}

test('paginates via cursor and maps name/status/module', async () => {
  const moduleColId = 'status_module'
  const page1 = { boards: [{ items_page: { cursor: 'C1', items: [
    { name: 'F-01-06 · Eligibility', column_values: [
      { id: 'task_status', text: 'Done' },
      { id: moduleColId, text: 'Pricing & Eligibility' },
    ] },
  ] } }] }
  const page2 = { next_items_page: { cursor: null, items: [
    { name: 'CLTV issue', column_values: [
      { id: 'task_status', text: 'In Progress' },
      { id: moduleColId, text: null },
    ] },
  ] } }
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce(jsonRes(page1))
    .mockResolvedValueOnce(jsonRes(page2))

  const stories = await fetchBoardStories({
    token: 't', boardId: 1, moduleColumnId: moduleColId,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })

  expect(fetchImpl).toHaveBeenCalledTimes(2)
  expect(stories).toEqual([
    { name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility' },
    { name: 'CLTV issue', status: 'In Progress', module: null },
  ])
})

test('throws on a GraphQL errors payload', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({
    ok: true, json: () => Promise.resolve({ errors: [{ message: 'bad' }] }),
  })
  await expect(fetchBoardStories({
    token: 't', boardId: 1, moduleColumnId: 'm',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })).rejects.toThrow(/Monday API error/)
})

test('throws on a non-ok HTTP response', async () => {
  const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) })
  await expect(fetchBoardStories({
    token: 't', boardId: 1, moduleColumnId: 'm',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  })).rejects.toThrow(/HTTP 500/)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/monday`
Expected: FAIL ("Cannot find module './monday'").

- [ ] **Step 3: Create `api/_lib/monday.ts`**

```ts
export interface RawStory {
  name: string
  status: string
  module: string | null
}

interface MondayColumnValue {
  id: string
  text: string | null
}

interface MondayItem {
  name: string
  column_values: MondayColumnValue[]
}

interface ItemsPage {
  cursor: string | null
  items: MondayItem[]
}

const MONDAY_API = 'https://api.monday.com/v2'

async function mondayRequest(
  fetchImpl: typeof fetch,
  token: string,
  query: string,
): Promise<Record<string, unknown>> {
  const res = await fetchImpl(MONDAY_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      'API-Version': '2024-10',
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Monday API HTTP ${res.status}`)
  const json = (await res.json()) as { data?: Record<string, unknown>; errors?: unknown }
  if (json.errors) throw new Error(`Monday API error: ${JSON.stringify(json.errors)}`)
  return json.data ?? {}
}

function toStory(item: MondayItem, moduleColumnId: string): RawStory {
  const textOf = (id: string) => item.column_values.find((c) => c.id === id)?.text ?? null
  return {
    name: item.name,
    status: textOf('task_status') ?? '',
    module: textOf(moduleColumnId),
  }
}

export async function fetchBoardStories(opts: {
  token: string
  boardId: number
  moduleColumnId: string
  pageLimit?: number
  fetchImpl?: typeof fetch
}): Promise<RawStory[]> {
  const { token, boardId, moduleColumnId, pageLimit = 100, fetchImpl = fetch } = opts
  const cols = JSON.stringify(['task_status', moduleColumnId])
  const out: RawStory[] = []

  const firstData = await mondayRequest(
    fetchImpl,
    token,
    `query { boards(ids: ${boardId}) { items_page(limit: ${pageLimit}) { cursor items { name column_values(ids: ${cols}) { id text } } } } }`,
  )
  let page = (firstData.boards as Array<{ items_page: ItemsPage }>)[0].items_page
  out.push(...page.items.map((i) => toStory(i, moduleColumnId)))

  while (page.cursor) {
    const nextData = await mondayRequest(
      fetchImpl,
      token,
      `query { next_items_page(limit: ${pageLimit}, cursor: "${page.cursor}") { cursor items { name column_values(ids: ${cols}) { id text } } } }`,
    )
    page = nextData.next_items_page as ItemsPage
    out.push(...page.items.map((i) => toStory(i, moduleColumnId)))
  }

  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/_lib/monday`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the import-extension guard**

Run: `npx vitest run api/import-extensions`
Expected: PASS (`monday.ts` has no relative imports, so trivially clean).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/monday.ts api/_lib/monday.test.ts
git commit -m "Add Monday GraphQL client with cursor pagination"
```

---

### Task 3: Per-module rollup and payload assembly

**Files:**
- Create: `api/_lib/rollup.ts`
- Test: `api/_lib/rollup.test.ts`

**Interfaces:**
- Consumes: `RawStory` from `./monday`; `DELIVERY_KEYS`, `bucketForStatus`, `cleanTitle`, `moduleKeyForLabel`, `statusFromPercent`, `STATUS_LABELS` from `./config`; `DeliveryModule`, `Module`, `ReadinessPayload`, `MODULES_BY_KEY` from `shared/readiness`.
- Produces: `buildDeliveryModule(key: string, stories: RawStory[]): DeliveryModule`; `buildDeliveryModules(stories: RawStory[]): Record<string, DeliveryModule>`; `assembleLivePayload(stories: RawStory[], now: string): ReadinessPayload`.

- [ ] **Step 1: Write the failing test `api/_lib/rollup.test.ts`**

```ts
import { expect, test } from 'vitest'
import { assembleLivePayload, buildDeliveryModule } from './rollup'
import { MODULES_BY_KEY } from '../../shared/readiness'
import type { RawStory } from './monday'

test('rolls up counts, percent, status, note, and cleaned titles', () => {
  const stories: RawStory[] = [
    { name: 'F-01-06 · Eligibility evaluation', status: 'Done', module: 'Pricing & Eligibility' },
    { name: 'CLTV calculation issue', status: 'In Progress', module: 'Pricing & Eligibility' },
    { name: 'Series 2 rules', status: 'Ready to start', module: 'Pricing & Eligibility' },
  ]
  const m = buildDeliveryModule('pe', stories)
  expect(m.assumed).toBe(false)
  expect(m.counts).toEqual({ delivered: 1, inProgress: 1, remaining: 1 })
  expect(m.percent).toBe(33)
  expect(m.status).toBe('early')
  expect(m.statusLabel).toBe('Early build')
  expect(m.note).toBe('1 of 3 stories accepted.')
  expect(m.buckets.delivered[0].title).toBe('Eligibility evaluation')
  expect(m.buckets.inProgress[0].title).toBe('CLTV calculation issue')
  expect(m.buckets.remaining[0].title).toBe('Series 2 rules')
})

test('a module with no stories falls back to the assumed baseline', () => {
  const base = MODULES_BY_KEY['tax']
  const m = buildDeliveryModule('tax', [])
  expect(m.assumed).toBe(true)
  expect(m.percent).toBe(base.percent)
  expect(m.buckets).toBe((base as typeof m).buckets)
})

test('assembleLivePayload returns 7 modules in PoC order, bank from fixture, source live', () => {
  const p = assembleLivePayload([], '2026-06-18T00:00:00Z')
  expect(p.modules.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'tax'])
  expect(p.source).toBe('live')
  expect(p.builtAt).toBe('2026-06-18T00:00:00Z')
  expect(p.modules.find((m) => m.key === 'bank')).toBe(MODULES_BY_KEY['bank'])
})

test('bank-labeled stories are ignored by the delivery rollup', () => {
  const stories: RawStory[] = [
    { name: 'U-02-01 · Bank Statement Analyzer', status: 'Done', module: 'Bank Analyzer' },
  ]
  const byKey = assembleLivePayload(stories, 'now')
  // bank remains the untouched fixture module
  expect(byKey.modules.find((m) => m.key === 'bank')).toBe(MODULES_BY_KEY['bank'])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/_lib/rollup`
Expected: FAIL ("Cannot find module './rollup'").

- [ ] **Step 3: Create `api/_lib/rollup.ts`**

```ts
import type { BucketItem, DeliveryModule, Module, ReadinessPayload } from '../../shared/readiness.js'
import { MODULES_BY_KEY } from '../../shared/readiness.js'
import type { RawStory } from './monday.js'
import {
  DELIVERY_KEYS,
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  statusFromPercent,
  STATUS_LABELS,
} from './config.js'

export function buildDeliveryModule(key: string, stories: RawStory[]): DeliveryModule {
  const base = MODULES_BY_KEY[key] as DeliveryModule
  if (stories.length === 0) {
    return { ...base, assumed: true }
  }

  const buckets = {
    delivered: [] as BucketItem[],
    inProgress: [] as BucketItem[],
    remaining: [] as BucketItem[],
  }
  for (const s of stories) {
    buckets[bucketForStatus(s.status)].push({ title: cleanTitle(s.name) })
  }

  const counts = {
    delivered: buckets.delivered.length,
    inProgress: buckets.inProgress.length,
    remaining: buckets.remaining.length,
  }
  const total = counts.delivered + counts.inProgress + counts.remaining
  const percent = Math.round((counts.delivered / total) * 100)
  const status = statusFromPercent(percent)

  return {
    ...base,
    assumed: false,
    percent,
    status,
    statusLabel: STATUS_LABELS[status],
    note: `${counts.delivered} of ${total} stories accepted.`,
    counts,
    buckets,
  }
}

export function buildDeliveryModules(stories: RawStory[]): Record<string, DeliveryModule> {
  const byKey: Record<string, RawStory[]> = {}
  for (const k of DELIVERY_KEYS) byKey[k] = []
  for (const s of stories) {
    const key = moduleKeyForLabel(s.module)
    if (key && key !== 'bank' && byKey[key]) byKey[key].push(s)
  }
  const result: Record<string, DeliveryModule> = {}
  for (const k of DELIVERY_KEYS) result[k] = buildDeliveryModule(k, byKey[k])
  return result
}

export function assembleLivePayload(stories: RawStory[], now: string): ReadinessPayload {
  const d = buildDeliveryModules(stories)
  const bank = MODULES_BY_KEY['bank']
  const modules: Module[] = [d.pe, d.vt, d.uw, d.lexi, bank, d.id, d.tax]
  return { asOf: now, builtAt: now, source: 'live', modules }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/_lib/rollup`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the import-extension guard**

Run: `npx vitest run api/import-extensions`
Expected: PASS (`rollup.ts` relative imports all end in `.js`).

- [ ] **Step 6: Commit**

```bash
git add api/_lib/rollup.ts api/_lib/rollup.test.ts
git commit -m "Add per-module rollup and live payload assembly"
```

---

### Task 4: Vercel Blob last-known-good store

**Files:**
- Create: `api/_lib/blob.ts`
- Modify: `package.json` (add `@vercel/blob`)
- Test: `api/_lib/blob.test.ts`

**Interfaces:**
- Consumes: `ReadinessPayload` from `shared/readiness`; `put`, `head` from `@vercel/blob`.
- Produces: `writeLatest(payload: ReadinessPayload): Promise<void>`; `readLatest(fetchImpl?: typeof fetch): Promise<ReadinessPayload | null>`.

> Note: the Blob holds exactly the same payload `/api/readiness` serves publicly, so `access: 'public'` is not a data leak — it is the same non-sensitive delivery snapshot. `addRandomSuffix: false` + `allowOverwrite: true` keep a single stable object at `readiness/latest.json`.

- [ ] **Step 1: Install the dependency**

Run: `npm install @vercel/blob`
Expected: adds `@vercel/blob` to `dependencies` in `package.json` and updates `package-lock.json`.

- [ ] **Step 2: Write the failing test `api/_lib/blob.test.ts`**

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { head, put } from '@vercel/blob'
import { readLatest, writeLatest } from './blob'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), head: vi.fn() }))

afterEach(() => vi.clearAllMocks())

test('writeLatest puts the JSON at the fixed path with overwrite enabled', async () => {
  const payload = { asOf: 'x', modules: [], source: 'live' as const }
  await writeLatest(payload)
  expect(put).toHaveBeenCalledWith(
    'readiness/latest.json',
    JSON.stringify(payload),
    expect.objectContaining({ access: 'public', addRandomSuffix: false, allowOverwrite: true }),
  )
})

test('readLatest returns the parsed payload', async () => {
  vi.mocked(head).mockResolvedValue({ url: 'https://blob/readiness/latest.json' } as never)
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ asOf: 'y', modules: [] }) })
  const p = await readLatest(fetchImpl as unknown as typeof fetch)
  expect(p).toEqual({ asOf: 'y', modules: [] })
})

test('readLatest returns null when the blob is missing', async () => {
  vi.mocked(head).mockRejectedValue(new Error('BlobNotFound'))
  const p = await readLatest()
  expect(p).toBeNull()
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run api/_lib/blob`
Expected: FAIL ("Cannot find module './blob'").

- [ ] **Step 4: Create `api/_lib/blob.ts`**

```ts
import { head, put } from '@vercel/blob'
import type { ReadinessPayload } from '../../shared/readiness.js'

const BLOB_PATH = 'readiness/latest.json'

export async function writeLatest(payload: ReadinessPayload): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(payload), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function readLatest(fetchImpl: typeof fetch = fetch): Promise<ReadinessPayload | null> {
  try {
    const meta = await head(BLOB_PATH)
    const res = await fetchImpl(meta.url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as ReadinessPayload
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run api/_lib/blob`
Expected: PASS (3 tests).

- [ ] **Step 6: Run the import-extension guard**

Run: `npx vitest run api/import-extensions`
Expected: PASS (`blob.ts` imports `../../shared/readiness.js`).

- [ ] **Step 7: Commit**

```bash
git add api/_lib/blob.ts api/_lib/blob.test.ts package.json package-lock.json
git commit -m "Add Vercel Blob last-known-good store"
```

---

### Task 5: Guarded `/api/refresh` cron rebuild

**Files:**
- Create: `api/refresh.ts`
- Test: `api/refresh.test.ts`

**Interfaces:**
- Consumes: `fetchBoardStories` from `./_lib/monday`; `assembleLivePayload` from `./_lib/rollup`; `writeLatest` from `./_lib/blob`; `getBoardId`, `getCronSecret`, `getModuleColumnId`, `getMondayToken` from `./_lib/config`.
- Produces: default Vercel handler at `/api/refresh`. On Monday failure it returns 500 and never calls `writeLatest` (last-known-good preserved).

- [ ] **Step 1: Write the failing test `api/refresh.test.ts`**

```ts
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

vi.mock('./_lib/monday.js', () => ({ fetchBoardStories: vi.fn() }))
vi.mock('./_lib/blob.js', () => ({ writeLatest: vi.fn() }))

import handler from './refresh'
import { fetchBoardStories } from './_lib/monday.js'
import { writeLatest } from './_lib/blob.js'

function mockRes() {
  const res: Partial<VercelResponse> & { body?: unknown; statusCode?: number } = {
    status(code: number) { this.statusCode = code; return this as VercelResponse },
    json(payload: unknown) { this.body = payload; return this as VercelResponse },
  }
  return res
}

beforeEach(() => {
  process.env.CRON_SECRET = 'secret'
  process.env.MONDAY_API_TOKEN = 'tok'
  process.env.MONDAY_MODULE_COLUMN_ID = 'status_module'
  process.env.ID_MONDAY = '18402839374'
})
afterEach(() => vi.clearAllMocks())

test('rejects requests without the cron secret', async () => {
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(401)
  expect(fetchBoardStories).not.toHaveBeenCalled()
  expect(writeLatest).not.toHaveBeenCalled()
})

test('on success fetches, assembles, writes the blob, and returns 200', async () => {
  vi.mocked(fetchBoardStories).mockResolvedValue([
    { name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility' },
  ])
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  expect(writeLatest).toHaveBeenCalledTimes(1)
})

test('on a Monday failure returns 500 and does NOT overwrite the blob', async () => {
  vi.mocked(fetchBoardStories).mockRejectedValue(new Error('Monday API HTTP 500'))
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(500)
  expect(writeLatest).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/refresh`
Expected: FAIL ("Cannot find module './refresh'").

- [ ] **Step 3: Create `api/refresh.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchBoardStories } from './_lib/monday.js'
import { assembleLivePayload } from './_lib/rollup.js'
import { writeLatest } from './_lib/blob.js'
import { getBoardId, getCronSecret, getModuleColumnId, getMondayToken } from './_lib/config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${getCronSecret()}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const stories = await fetchBoardStories({
      token: getMondayToken(),
      boardId: getBoardId(),
      moduleColumnId: getModuleColumnId(),
    })
    const payload = assembleLivePayload(stories, new Date().toISOString())
    await writeLatest(payload)
    return res.status(200).json({ ok: true, modules: payload.modules.length, builtAt: payload.builtAt })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/refresh`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the import-extension guard**

Run: `npx vitest run api/import-extensions`
Expected: PASS (`refresh.ts` relative imports all end in `.js`).

- [ ] **Step 6: Commit**

```bash
git add api/refresh.ts api/refresh.test.ts
git commit -m "Add guarded /api/refresh cron rebuild"
```

---

### Task 6: Refactor `/api/readiness` to read the Blob

**Files:**
- Modify: `api/readiness.ts`
- Test: `api/readiness.test.ts` (replace)

**Interfaces:**
- Consumes: `buildPayload` from `shared/readiness`; `readLatest` from `./_lib/blob`.
- Produces: async default handler — returns the Blob payload, or the config baseline (`source: 'baseline'`) when the Blob is missing.

- [ ] **Step 1: Replace `api/readiness.test.ts`**

(Removes the old synchronous handler test and the single-file import check — the import check now lives in `api/import-extensions.test.ts`.)

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

test('serves the last-known-good payload from the blob with cache header', async () => {
  vi.mocked(readLatest).mockResolvedValue(buildPayload('2026-06-18T00:00:00Z'))
  const res = mockRes()
  await handler({} as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[] }
  expect(body.modules).toHaveLength(7)
  expect(res.headers['Cache-Control']).toContain('s-maxage')
})

test('falls back to the config baseline when the blob is missing', async () => {
  vi.mocked(readLatest).mockResolvedValue(null)
  const res = mockRes()
  await handler({} as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source?: string }
  expect(body.modules).toHaveLength(7)
  expect(body.source).toBe('baseline')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run api/readiness`
Expected: FAIL (handler is still synchronous / does not call `readLatest`; baseline `source` assertion fails or mock unused).

- [ ] **Step 3: Replace `api/readiness.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPayload } from '../shared/readiness.js'
import { readLatest } from './_lib/blob.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
  const latest = await readLatest()
  res.status(200).json(latest ?? buildPayload(new Date().toISOString()))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/readiness`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the import-extension guard and the full suite**

Run: `npx vitest run api/import-extensions && npx vitest run`
Expected: PASS — import guard clean; full suite green (existing 22 + the new connector tests).

- [ ] **Step 6: Commit**

```bash
git add api/readiness.ts api/readiness.test.ts
git commit -m "Read last-known-good Blob in /api/readiness with baseline fallback"
```

---

### Task 7: Cron config + deploy wiring + env documentation

**Files:**
- Modify: `vercel.json`
- Create: `.env.example`
- Test: `shared/deploy-config.test.ts`

**Interfaces:**
- Produces: a registered cron for `/api/refresh`; documented env var names; a regression test asserting both the cron entry and the test-exclusion are present.

- [ ] **Step 1: Write the failing test `shared/deploy-config.test.ts`**

```ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('vercel.json registers the /api/refresh cron', () => {
  const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
  const paths = (cfg.crons ?? []).map((c: { path: string }) => c.path)
  expect(paths).toContain('/api/refresh')
})

test('.vercelignore keeps test files out of the deploy', () => {
  const ignore = readFileSync(join(root, '.vercelignore'), 'utf8')
  expect(ignore).toContain('*.test.ts')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run shared/deploy-config`
Expected: FAIL (`vercel.json` has no `crons`).

- [ ] **Step 3: Add the cron to `vercel.json`**

```json
{
  "crons": [{ "path": "/api/refresh", "schedule": "*/15 * * * *" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex" }] }
  ]
}
```

- [ ] **Step 4: Create `.env.example` (names only, no secrets)**

```bash
# Monday API (server-side only — never VITE_*)
MONDAY_API_TOKEN=
# Stories board id
ID_MONDAY=18402839374
# id of the "Module" status column on the Stories board (set after creating it)
MONDAY_MODULE_COLUMN_ID=
# shared secret guarding /api/refresh (Vercel sends it as `Authorization: Bearer <CRON_SECRET>`)
CRON_SECRET=
# injected automatically when the Vercel Blob store is linked
BLOB_READ_WRITE_TOKEN=
```

- [ ] **Step 5: Confirm `.env*` is gitignored (no secrets can be committed)**

Run: `git check-ignore .env .env.local; git ls-files | grep -E '^\.env' || echo "no .env tracked (good)"`
Expected: `.env` and `.env.local` print as ignored; `.env.example` is the only env file tracked. If `.env*` is not ignored, add `.env` and `.env*.local` to `.gitignore` (but keep `!.env.example`).

- [ ] **Step 6: Run the deploy-config test and the full suite + build**

Run: `npx vitest run shared/deploy-config && npx vitest run && npm run build`
Expected: deploy-config PASS; full suite green; `npm run build` succeeds (`tsc -b && vite build`, `dist/` emitted).

- [ ] **Step 7: Commit**

```bash
git add vercel.json .env.example shared/deploy-config.test.ts .gitignore
git commit -m "Register /api/refresh cron and document Phase 2a env vars"
```

---

### Task 8: Deploy + live verification (manual — blocked on external prerequisites)

**Files:** none (deploy + handoff step). **Do not execute autonomously.** This task depends on account/billing, secrets, and board changes owned by the user/team. Surface it, then stop and hand off.

**External prerequisites (gate going live, not the code):**
- **Vercel Pro upgrade** on project `lendz-dashboard` (Hobby crons run ~once/day; 15-min needs Pro). Owner: account/billing — confirm with Juan.
- **Provision a Vercel Blob store** (`vercel blob store add` or dashboard) → injects `BLOB_READ_WRITE_TOKEN`.
- **Create the "Module" `status` column** on board `18402839374` with labels: `Pricing & Eligibility`, `Verified Truth`, `Underwriting`, `Lexi`, `ID Analyzer`, `Tax Docs` (+ optional `Bank Analyzer`). Read its column id (via `get_board_info` / the board settings) → that is `MONDAY_MODULE_COLUMN_ID`.
- **Create a Monday API token** (Arturo) for the function.
- **Set env in Vercel** (Preview + Production): `MONDAY_API_TOKEN`, `ID_MONDAY=18402839374`, `MONDAY_MODULE_COLUMN_ID`, `CRON_SECRET`.
- **Team handoff note** to Juan/Carlos/Javi: until the "Module" column is populated, every delivery module renders as `assumed`/baseline (identical to v1) — safe. The numbers light up per module as stories get tagged.

- [ ] **Step 1: Manually trigger a rebuild and confirm the Blob is written**

Run (after env + Blob are set, against a preview deploy): `curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/refresh`
Expected: `{"ok":true,"modules":7,...}`. A request without the header returns 401.

- [ ] **Step 2: Verify the live endpoint serves the rebuilt payload**

Run: `curl -s https://<preview-url>/api/readiness | jq '{source, builtAt, keys: [.modules[].key]}'`
Expected: `source: "live"`, 7 module keys in PoC order; modules with tagged stories show live counts/percent, the rest show `assumed` baseline.

- [ ] **Step 3: Confirm the cron is registered**

Check the Vercel dashboard (Project → Settings → Cron Jobs) for `/api/refresh` at `*/15 * * * *`. (Requires Pro.)

- [ ] **Step 4: Stop and hand off**

Per the project git-flow: feature→develop is implicit only when ALL automated tests and the required manual tests above pass; develop→main and production promotion need a fresh explicit user OK. Do not merge or promote autonomously. Report results and the team handoff note.

---

## Self-Review

**Spec coverage:**
- §2 scope (six delivery modules live, bank fixture) → Tasks 3 (rollup excludes bank), 6.
- §3 board finding / no module dimension → addressed by the §5 column contract → Tasks 1 (label map), 8 (column creation).
- §5 "Module" column, referenced by env, build wiring-ready → Tasks 1 (`MODULE_LABELS`, `getModuleColumnId`), 2, 8.
- §6 status→bucket → Task 1 (`STATUS_BUCKET`/`bucketForStatus`), exercised in Task 3.
- §7 rollup (counts/percent/pill, live items, title cleanup, 0→assumed) → Tasks 1 (`statusFromPercent`, `cleanTitle`), 3.
- §8 computed vs editorial, derived `assumed`, templated `note` → Task 3.
- §9 additive contract (`source`/`builtAt`) → Task 1; consumed in Tasks 3, 6.
- §10 file structure / server-only `_lib` / `.js` extensions → all tasks + Task 1 import guard.
- §11 data flow (cron→Blob, request reads Blob) → Tasks 4, 5, 6.
- §12 error handling (cron no-overwrite on failure; request baseline fallback), caching, security (token server-only, CRON_SECRET) → Tasks 5, 6, 7.
- §13 testing → every task carries its own tests; full suite verified in Task 6/7.
- §14 deploy prerequisites/handoff → Task 8.

**Placeholder scan:** No "TBD/TODO". `.env.example` blanks are intentional (documented var names, no secrets). `MONDAY_MODULE_COLUMN_ID` unknown-until-created is explicit and env-injected. Task 8 is intentionally manual and marked do-not-execute.

**Type consistency:** `RawStory` (Task 2) consumed unchanged in Tasks 3, 5. `assembleLivePayload(stories, now)` (Task 3) called with the same signature in Task 5. `readLatest`/`writeLatest` (Task 4) consumed in Tasks 5, 6 with matching signatures. `ReadinessPayload.source`/`builtAt` (Task 1) produced in Task 3, read in Task 6. `DELIVERY_KEYS`, `bucketForStatus`, `statusFromPercent`, `STATUS_LABELS`, `cleanTitle`, `moduleKeyForLabel` (Task 1) consumed with identical names in Task 3. Module key order `['pe','vt','uw','lexi','bank','id','tax']` matches the existing fixture and is asserted in Task 3.
