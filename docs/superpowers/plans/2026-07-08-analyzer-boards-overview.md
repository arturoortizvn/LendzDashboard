# Per-analyzer Monday boards + Analyzers overview — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Point Bank/ID at dedicated Monday boards, add P&L and Paystub analyzers from their own boards, keep Tax on the shared board, and add a two-tier Analyzers section with a combined overview.

**Architecture:** The Readiness Console reads Monday boards in `/api/refresh` (cron), rolls them into a `ReadinessPayload`, caches it in Vercel Blob, and serves it from `/api/readiness` to a React SPA. This change makes each analyzer read from its own dedicated board (whole board = one analyzer, no `module` routing), keeps Tax routed by `module='Tax Analyzer'` off the shared board, adds two new analyzer modules, and reshapes the SPA nav into top-level modules + an Analyzers section (Overview + one sub-tab per analyzer).

**Tech Stack:** TypeScript, React 19, Vite, Vitest + Testing Library, Vercel Functions (`@vercel/node`), Vercel Blob, Monday GraphQL API.

## Global Constraints

- Comments: none by default; only a one-line *why* for a non-obvious decision (English).
- All identifiers, comments, and commit messages in English.
- API files under `api/**` MUST use `.js` import extensions (enforced by `api/import-extensions.test.ts`). Frontend files under `src/**` import without extensions.
- Secrets never in `VITE_*` vars. Board-id env vars are server-side only.
- TDD: red → green → commit. Run `npm test` (vitest) per task.
- Payload module order is fixed: `[pe, vt, uw, lexi, bank, id, pl, paystub, tax]`.
- Dedicated analyzer boards (Bank/ID/P&L/Paystub) are read whole with `statusColumnId: 'task_status'` and **no** module column. Tax reads the shared board `18403908550` with `statusColumnId: 'status'` and module label `'Tax Analyzer'`.
- Board defaults: Bank `18420951194`, ID `18420951197`, P&L `18420951201`, Paystub `18420951200`, shared/Tax `18403908550`, Stories `18402839374`.
- Every commit message ends with the trailer:
  `Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV`

---

### Task 1: Model — add `pl` & `paystub` modules and `ANALYZER_KEYS`

**Files:**
- Modify: `shared/readiness.ts`
- Test: `shared/readiness.test.ts`

**Interfaces:**
- Produces: `ANALYZER_KEYS: readonly ['bank','id','pl','paystub','tax']`; `MODULES` now length 9 in the fixed order; baseline `DeliveryModule`s for keys `'pl'` and `'paystub'` (both `assumed: true`).

- [ ] **Step 1: Update the failing tests**

In `shared/readiness.test.ts`, replace the first two tests and add an `ANALYZER_KEYS` test:

```ts
import { MODULES, ANALYZER_KEYS, buildPayload } from './readiness'

test('exposes nine modules in tab order', () => {
  expect(MODULES.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'pl', 'paystub', 'tax'])
})

test('flags exactly the assumed modules', () => {
  const assumed = MODULES.filter((m) => m.assumed).map((m) => m.key)
  expect(assumed.sort()).toEqual(['bank', 'id', 'paystub', 'pl', 'tax', 'vt'])
})

test('ANALYZER_KEYS lists the five analyzers in order', () => {
  expect(ANALYZER_KEYS).toEqual(['bank', 'id', 'pl', 'paystub', 'tax'])
})
```

Keep the existing `'bank is a delivery module'` and `'buildPayload stamps asOf'` tests unchanged.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- shared/readiness.test.ts`
Expected: FAIL (`pl`/`paystub` missing; `ANALYZER_KEYS` not exported).

- [ ] **Step 3: Implement in `shared/readiness.ts`**

Add the `ANALYZER_KEYS` export just above `buildPayload`:

```ts
export const ANALYZER_KEYS = ['bank', 'id', 'pl', 'paystub', 'tax'] as const
```

Add these two module definitions after the `id` module and before `tax`:

```ts
const pl: DeliveryModule = {
  key: 'pl',
  name: 'P&L Analyzer',
  sub: 'Profit & Loss statement extraction for self-employed Non-QM income.',
  phase: 'delivery',
  percent: 0,
  status: 'early',
  statusLabel: 'Early build',
  note: 'Dedicated board just seeded. Figures assumed until stories land.',
  targetDate: 'Release Two',
  dateConfidence: 'projected',
  assumed: true,
  assumedLabel: 'Awaiting board data',
  accentColor: '#B5654A',
  counts: { delivered: 0, inProgress: 0, remaining: 0 },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const paystub: DeliveryModule = {
  key: 'paystub',
  name: 'Paystub Analyzer',
  sub: 'Income extraction and verification from paystubs.',
  phase: 'delivery',
  percent: 0,
  status: 'early',
  statusLabel: 'Early build',
  note: 'Dedicated board just seeded. Figures assumed until stories land.',
  targetDate: 'Release Two',
  dateConfidence: 'projected',
  assumed: true,
  assumedLabel: 'Awaiting board data',
  accentColor: '#5B8C5A',
  counts: { delivered: 0, inProgress: 0, remaining: 0 },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}
```

Update the `MODULES` export:

```ts
export const MODULES: Module[] = [pe, vt, uw, lexi, bank, id, pl, paystub, tax]
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- shared/readiness.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/readiness.ts shared/readiness.test.ts
git commit -m "$(cat <<'EOF'
Add P&L and Paystub analyzer modules and ANALYZER_KEYS

Why: LendLogic added two analyzers, each with its own dedicated Monday
board. Seed their baseline modules (assumed) and a shared analyzer-key
list the rollup and SPA both consume.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 2: Config — dedicated board source map + keys + env docs

**Files:**
- Modify: `api/_lib/config.ts`
- Modify: `.env.example`
- Test: `api/_lib/config.test.ts`

**Interfaces:**
- Consumes: `ANALYZER_KEYS` from `shared/readiness`.
- Produces:
  - `ModuleKey` union extended with `'pl' | 'paystub'`.
  - `ANALYZER_KEYS` re-exported from config (unchanged import site for callers).
  - `DEDICATED_ANALYZER_KEYS: readonly ['bank','id','pl','paystub']`; `type DedicatedAnalyzerKey`.
  - `DEDICATED_ANALYZER_BOARDS: Record<DedicatedAnalyzerKey, number>` (defaults).
  - `getDedicatedAnalyzerBoardId(key: DedicatedAnalyzerKey): number` — env override → default.

- [ ] **Step 1: Update the failing tests**

In `api/_lib/config.test.ts`, change the import block to pull `ANALYZER_KEYS` and the new symbols, replace the `ANALYZER_KEYS` assertion, and add dedicated-board tests:

```ts
import {
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  statusFromPercent,
  DELIVERY_KEYS,
  FORCE_ASSUMED,
  getBoardId,
  BOARD_ID,
  ANALYZER_KEYS,
  getAnalyzerBoardId,
  getAnalyzerColumnId,
  ANALYZER_BOARD_ID,
  DEDICATED_ANALYZER_KEYS,
  DEDICATED_ANALYZER_BOARDS,
  getDedicatedAnalyzerBoardId,
} from './config'
```

Replace the old `'ANALYZER_KEYS are bank/id/tax'` test with:

```ts
test('ANALYZER_KEYS are bank/id/pl/paystub/tax', () => {
  expect(ANALYZER_KEYS).toEqual(['bank', 'id', 'pl', 'paystub', 'tax'])
})

test('DEDICATED_ANALYZER_KEYS are the four own-board analyzers', () => {
  expect(DEDICATED_ANALYZER_KEYS).toEqual(['bank', 'id', 'pl', 'paystub'])
})

test('DEDICATED_ANALYZER_BOARDS maps each analyzer to its default board id', () => {
  expect(DEDICATED_ANALYZER_BOARDS).toEqual({
    bank: 18420951194,
    id: 18420951197,
    pl: 18420951201,
    paystub: 18420951200,
  })
})

test('getDedicatedAnalyzerBoardId returns the default when the env is unset/invalid, else the parsed override', () => {
  const orig = process.env.ID_MONDAY_BANK
  delete process.env.ID_MONDAY_BANK
  expect(getDedicatedAnalyzerBoardId('bank')).toBe(18420951194)
  process.env.ID_MONDAY_BANK = 'not-a-number'
  expect(getDedicatedAnalyzerBoardId('bank')).toBe(18420951194)
  process.env.ID_MONDAY_BANK = '55555'
  expect(getDedicatedAnalyzerBoardId('bank')).toBe(55555)
  process.env.ID_MONDAY_BANK = orig
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- api/_lib/config.test.ts`
Expected: FAIL (new symbols not exported).

- [ ] **Step 3: Implement in `api/_lib/config.ts`**

Extend the `ModuleKey` union:

```ts
export type ModuleKey = 'pe' | 'vt' | 'uw' | 'lexi' | 'bank' | 'id' | 'pl' | 'paystub' | 'tax'
```

Re-export `ANALYZER_KEYS` from shared (replaces the old local `ANALYZER_KEYS` literal — delete that line):

```ts
export { ANALYZER_KEYS } from '../../shared/readiness.js'
```

Add the dedicated-board config near the other board getters:

```ts
export const DEDICATED_ANALYZER_KEYS = ['bank', 'id', 'pl', 'paystub'] as const
export type DedicatedAnalyzerKey = (typeof DEDICATED_ANALYZER_KEYS)[number]

export const DEDICATED_ANALYZER_BOARDS: Record<DedicatedAnalyzerKey, number> = {
  bank: 18420951194,
  id: 18420951197,
  pl: 18420951201,
  paystub: 18420951200,
}

const DEDICATED_ANALYZER_ENV: Record<DedicatedAnalyzerKey, string> = {
  bank: 'ID_MONDAY_BANK',
  id: 'ID_MONDAY_ID',
  pl: 'ID_MONDAY_PL',
  paystub: 'ID_MONDAY_PAYSTUB',
}

export function getDedicatedAnalyzerBoardId(key: DedicatedAnalyzerKey): number {
  const n = Number(process.env[DEDICATED_ANALYZER_ENV[key]])
  return Number.isFinite(n) && n > 0 ? n : DEDICATED_ANALYZER_BOARDS[key]
}
```

> Note: the old `ANALYZER_KEYS` literal and any `buildAnalyzerModules` reliance on it are removed here; the rollup refactor (Task 3) stops using it.

- [ ] **Step 4: Document the env vars**

Append to `.env.example` (after the `ID_MONDAY_ANALYZERS` line):

```
# Dedicated analyzer board ids (one board per analyzer)
ID_MONDAY_BANK=18420951194
ID_MONDAY_ID=18420951197
ID_MONDAY_PL=18420951201
ID_MONDAY_PAYSTUB=18420951200
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `npm test -- api/_lib/config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_lib/config.ts api/_lib/config.test.ts .env.example
git commit -m "$(cat <<'EOF'
Map each dedicated analyzer to its own Monday board

Why: Bank/ID/P&L/Paystub now each have a dedicated board. Add per-analyzer
board ids (env-overridable) and widen ANALYZER_KEYS to the five analyzers,
sourced once from the shared model.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 3: Rollup — `buildTaxModule` + new `assembleLivePayload` signature

**Files:**
- Modify: `api/_lib/rollup.ts`
- Test: `api/_lib/rollup.test.ts`

**Interfaces:**
- Consumes: `buildDeliveryModule`, private `buildModulesForKeys`, `DedicatedAnalyzerKey`.
- Produces:
  - `buildTaxModule(stories: RawStory[]): DeliveryModule` — routes `Tax Analyzer` + `Shared` labels; assumed baseline when empty.
  - `assembleLivePayload(deliveryStories: RawStory[], dedicated: Record<DedicatedAnalyzerKey, RawStory[]>, taxStories: RawStory[], now: string): ReadinessPayload` — 9 modules, `source: 'live'`.
  - `buildAnalyzerModules` is **removed**.

- [ ] **Step 1: Rewrite the analyzer tests**

In `api/_lib/rollup.test.ts`:

- Update the import line:

```ts
import { assembleLivePayload, buildTaxModule, buildDeliveryModule } from './rollup'
```

- Replace the three `buildAnalyzerModules …` tests and the two `assembleLivePayload …` tests with:

```ts
test('assembleLivePayload returns 9 modules in tab order, source live', () => {
  const p = assembleLivePayload([], { bank: [], id: [], pl: [], paystub: [] }, [], '2026-07-08T00:00:00Z')
  expect(p.modules.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'pl', 'paystub', 'tax'])
  expect(p.source).toBe('live')
  expect(p.builtAt).toBe('2026-07-08T00:00:00Z')
  expect(p.asOf).toBe('2026-07-08T00:00:00Z')
})

test('dedicated analyzer stories count regardless of the module column', () => {
  const p = assembleLivePayload(
    [],
    {
      bank: [{ name: 'Done thing', status: 'Done', module: null }],
      id: [],
      pl: [{ name: 'PL story', status: 'Ready to start', module: 'Tax Analyzer' }],
      paystub: [],
    },
    [],
    'now',
  )
  const bank = p.modules.find((m) => m.key === 'bank')!
  expect(bank.assumed).toBe(false)
  expect(bank.counts).toEqual({ delivered: 1, inProgress: 0, remaining: 0 })
  const pl = p.modules.find((m) => m.key === 'pl')!
  expect(pl.assumed).toBe(false)
  expect(pl.counts).toEqual({ delivered: 0, inProgress: 0, remaining: 1 })
})

test('analyzer-labeled stories on the Stories board are ignored by the delivery rollup', () => {
  const stories: RawStory[] = [
    { name: 'U-02-01 · Bank Statement Analyzer', status: 'Done', module: 'Bank Analyzer' },
  ]
  const p = assembleLivePayload(stories, { bank: [], id: [], pl: [], paystub: [] }, [], 'now')
  expect(p.modules.find((m) => m.key === 'bank')!.assumed).toBe(true)
})

test('assembleLivePayload routes a real Module label to its delivery module', () => {
  const stories: RawStory[] = [
    { name: 'F-01-06 · Eligibility evaluation', status: 'Done', module: 'Pricing and Eligibility' },
  ]
  const p = assembleLivePayload(stories, { bank: [], id: [], pl: [], paystub: [] }, [], '2026-07-08T00:00:00Z')
  const pe = p.modules.find((m) => m.key === 'pe') as DeliveryModule | undefined
  expect(pe?.assumed).toBe(false)
  expect(pe?.counts.delivered).toBe(1)
})

test('buildTaxModule routes Tax Analyzer and Shared labels from the shared board', () => {
  const stories: RawStory[] = [
    { name: 'Tax form extraction', status: 'Done', module: 'Tax Analyzer' },
    { name: 'Shared infra', status: 'Working on it', module: 'Shared' },
    { name: 'Bank thing', status: 'Done', module: 'Bank Analyzer' },
  ]
  const tax = buildTaxModule(stories)
  expect(tax.assumed).toBe(false)
  expect(tax.counts).toEqual({ delivered: 1, inProgress: 1, remaining: 0 })
})

test('buildTaxModule with no tax stories falls back to the assumed baseline', () => {
  expect(buildTaxModule([]).assumed).toBe(true)
})
```

Keep unchanged: `'rolls up counts, percent, status, note, and cleaned titles'`, `'a module with no stories falls back to the assumed baseline'`, `'zero-stories assumed: …'`, `'vt computes live from its stories …'`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- api/_lib/rollup.test.ts`
Expected: FAIL (`buildTaxModule` missing; `assembleLivePayload` arity changed).

- [ ] **Step 3: Implement in `api/_lib/rollup.ts`**

Add the `DedicatedAnalyzerKey` type to the config import and a tax-only key constant, add `buildTaxModule`, and rewrite `assembleLivePayload`. Remove `buildAnalyzerModules`.

```ts
import {
  ANALYZER_KEYS,            // still fine to leave imported if used elsewhere; otherwise drop
  DELIVERY_KEYS,
  FORCE_ASSUMED,
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  SHARED_LABEL,
  statusFromPercent,
  STATUS_LABELS,
  type ModuleKey,
  type DedicatedAnalyzerKey,
} from './config.js'

const TAX_ONLY: readonly ModuleKey[] = ['tax']

export function buildTaxModule(stories: RawStory[]): DeliveryModule {
  return buildModulesForKeys(stories, TAX_ONLY).tax
}

export function assembleLivePayload(
  deliveryStories: RawStory[],
  dedicated: Record<DedicatedAnalyzerKey, RawStory[]>,
  taxStories: RawStory[],
  now: string,
): ReadinessPayload {
  const d = buildDeliveryModules(deliveryStories)
  const bank = buildDeliveryModule('bank', dedicated.bank)
  const id = buildDeliveryModule('id', dedicated.id)
  const pl = buildDeliveryModule('pl', dedicated.pl)
  const paystub = buildDeliveryModule('paystub', dedicated.paystub)
  const tax = buildTaxModule(taxStories)
  const modules: Module[] = [d.pe, d.vt, d.uw, d.lexi, bank, id, pl, paystub, tax]
  return { asOf: now, builtAt: now, source: 'live', modules }
}
```

Delete the old `buildAnalyzerModules` function. If `ANALYZER_KEYS` is now unused in this file, remove it from the import to satisfy `tsc` (no-unused). Keep `buildModulesForKeys` (still used by `buildDeliveryModules` and `buildTaxModule`).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- api/_lib/rollup.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/rollup.ts api/_lib/rollup.test.ts
git commit -m "$(cat <<'EOF'
Assemble analyzers from dedicated boards, Tax from the shared board

Why: each dedicated board is one analyzer, so its stories are counted
whole with no module routing. Tax keeps its shared-board module routing.
assembleLivePayload now takes per-analyzer story lists and emits 9 modules.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 4: Refresh — fetch six boards

**Files:**
- Modify: `api/refresh.ts`
- Test: `api/refresh.test.ts`

**Interfaces:**
- Consumes: `getDedicatedAnalyzerBoardId`, updated `assembleLivePayload`.

- [ ] **Step 1: Update the failing test**

In `api/refresh.test.ts`, replace the `'fetches both boards …'` test:

```ts
test('fetches all six boards, assembles, writes the blob, and returns 200', async () => {
  vi.mocked(fetchBoardStories).mockResolvedValue([
    { name: 'F-01-06 · Eligibility', status: 'Done', module: 'Pricing & Eligibility' },
  ])
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  expect(fetchBoardStories).toHaveBeenCalledTimes(6)
  const boardIds = vi.mocked(fetchBoardStories).mock.calls.map((c) => c[0].boardId)
  expect(boardIds).toEqual(
    expect.arrayContaining([18402839374, 18420951194, 18420951197, 18420951201, 18420951200, 18403908550]),
  )
  expect(writeLatest).toHaveBeenCalledTimes(1)
})
```

Keep the `'rejects requests without the cron secret'` and `'on a Monday failure returns 500 …'` tests unchanged.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- api/refresh.test.ts`
Expected: FAIL (only 2 fetch calls).

- [ ] **Step 3: Implement in `api/refresh.ts`**

Add `getDedicatedAnalyzerBoardId` to the config import and rewrite the fetch/assemble block:

```ts
import {
  getAnalyzerBoardId,
  getAnalyzerColumnId,
  getBoardId,
  getCronSecret,
  getDedicatedAnalyzerBoardId,
  getModuleColumnId,
  getMondayToken,
} from './_lib/config.js'
```

```ts
    const token = getMondayToken()
    const [deliveryStories, bank, id, pl, paystub, taxStories] = await Promise.all([
      fetchBoardStories({ token, boardId: getBoardId(), moduleColumnId: getModuleColumnId() }),
      fetchBoardStories({ token, boardId: getDedicatedAnalyzerBoardId('bank'), statusColumnId: 'task_status' }),
      fetchBoardStories({ token, boardId: getDedicatedAnalyzerBoardId('id'), statusColumnId: 'task_status' }),
      fetchBoardStories({ token, boardId: getDedicatedAnalyzerBoardId('pl'), statusColumnId: 'task_status' }),
      fetchBoardStories({ token, boardId: getDedicatedAnalyzerBoardId('paystub'), statusColumnId: 'task_status' }),
      fetchBoardStories({ token, boardId: getAnalyzerBoardId(), statusColumnId: 'status', moduleColumnId: getAnalyzerColumnId() }),
    ])
    const payload = assembleLivePayload(
      deliveryStories,
      { bank, id, pl, paystub },
      taxStories,
      new Date().toISOString(),
    )
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- api/refresh.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/refresh.ts api/refresh.test.ts
git commit -m "$(cat <<'EOF'
Fetch the four dedicated analyzer boards plus Stories and shared Tax

Why: refresh now sources Bank/ID/P&L/Paystub from their own boards
(task_status, no module column) and Tax from the shared board, feeding
the new assembleLivePayload.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 5: Frontend lib — module partition + global percent

**Files:**
- Create: `src/lib/analyzers.ts`
- Test: `src/lib/analyzers.test.ts`

**Interfaces:**
- Consumes: `ANALYZER_KEYS`, `Module` from `shared/readiness`.
- Produces:
  - `partitionModules(modules: Module[]): { delivery: Module[]; analyzers: Module[] }` — `analyzers` in `ANALYZER_KEYS` order; `delivery` = the rest in payload order.
  - `globalAnalyzerPercent(analyzers: Module[]): number` — story-weighted, rounded, 0 when no stories.

- [ ] **Step 1: Write the failing test**

Create `src/lib/analyzers.test.ts`:

```ts
import { expect, test } from 'vitest'
import { partitionModules, globalAnalyzerPercent } from './analyzers'
import type { Module } from '../../shared/readiness'

const mk = (key: string, d: number, ip: number, r: number): Module => ({
  key,
  name: key,
  sub: '',
  phase: 'delivery',
  percent: 0,
  status: 'early',
  statusLabel: '',
  note: '',
  targetDate: '',
  dateConfidence: 'projected',
  assumed: false,
  counts: { delivered: d, inProgress: ip, remaining: r },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}) as Module

test('partitionModules splits delivery vs analyzers, analyzers in canonical order', () => {
  const modules = [
    mk('pe', 0, 0, 0), mk('bank', 0, 0, 0), mk('id', 0, 0, 0), mk('pl', 0, 0, 0),
    mk('paystub', 0, 0, 0), mk('tax', 0, 0, 0), mk('vt', 0, 0, 0),
  ]
  const { delivery, analyzers } = partitionModules(modules)
  expect(delivery.map((m) => m.key)).toEqual(['pe', 'vt'])
  expect(analyzers.map((m) => m.key)).toEqual(['bank', 'id', 'pl', 'paystub', 'tax'])
})

test('globalAnalyzerPercent is story-weighted across analyzers', () => {
  const analyzers = [mk('bank', 2, 0, 1), mk('id', 0, 1, 2)]
  expect(globalAnalyzerPercent(analyzers)).toBe(33) // 2 delivered / 6 total
})

test('globalAnalyzerPercent is 0 when there are no stories', () => {
  expect(globalAnalyzerPercent([mk('bank', 0, 0, 0)])).toBe(0)
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/lib/analyzers.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/analyzers.ts`**

```ts
import type { Module } from '../../shared/readiness'
import { ANALYZER_KEYS } from '../../shared/readiness'

export function partitionModules(modules: Module[]): { delivery: Module[]; analyzers: Module[] } {
  const analyzerSet = new Set<string>(ANALYZER_KEYS)
  const delivery = modules.filter((m) => !analyzerSet.has(m.key))
  const analyzers = ANALYZER_KEYS
    .map((k) => modules.find((m) => m.key === k))
    .filter((m): m is Module => m != null)
  return { delivery, analyzers }
}

export function globalAnalyzerPercent(analyzers: Module[]): number {
  let delivered = 0
  let total = 0
  for (const m of analyzers) {
    delivered += m.counts.delivered
    total += m.counts.delivered + m.counts.inProgress + m.counts.remaining
  }
  return total === 0 ? 0 : Math.round((delivered / total) * 100)
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- src/lib/analyzers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analyzers.ts src/lib/analyzers.test.ts
git commit -m "$(cat <<'EOF'
Add analyzer partition and story-weighted global percent helpers

Why: the SPA needs to split modules into delivery vs analyzers (in a
canonical order) and compute the combined analyzer readiness for the
overview.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 6: Tabs — generalize to `TabItem[]`

**Files:**
- Modify: `src/components/Tabs.tsx`
- Test: `src/components/Tabs.test.tsx`

**Interfaces:**
- Produces: `interface TabItem { key: string; name: string; percent?: number }`; `Tabs` now takes `items: TabItem[]` (was `modules: Module[]`) and renders the percent badge only when `percent != null`.

- [ ] **Step 1: Rewrite the test**

Replace `src/components/Tabs.test.tsx`:

```ts
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Tabs } from './Tabs'
import type { TabItem } from './Tabs'

const items: TabItem[] = [
  { key: 'pe', name: 'Pricing & Eligibility', percent: 71 },
  { key: 'analyzers', name: 'Analyzers', percent: 39 },
]

test('renders one tab per item, shows percent, and reports clicks', async () => {
  const onSelect = vi.fn()
  render(<Tabs items={items} activeKey="pe" onSelect={onSelect} />)
  expect(screen.getAllByRole('tab')).toHaveLength(2)
  expect(screen.getByText('71%')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: /Analyzers/ }))
  expect(onSelect).toHaveBeenCalledWith('analyzers')
})

test('omits the percent badge for items without a percent', () => {
  render(<Tabs items={[{ key: 'overview', name: 'Overview' }]} activeKey="overview" onSelect={() => {}} />)
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/components/Tabs.test.tsx`
Expected: FAIL (`items`/`TabItem` not supported).

- [ ] **Step 3: Rewrite `src/components/Tabs.tsx`**

```tsx
export interface TabItem {
  key: string
  name: string
  percent?: number
}

export function Tabs({ items, activeKey, onSelect }: {
  items: TabItem[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          className={`tab${it.key === activeKey ? ' active' : ''}`}
          role="tab"
          aria-selected={it.key === activeKey}
          onClick={() => onSelect(it.key)}
        >
          {it.name}
          {it.percent != null && <span className="mini">{it.percent}%</span>}
        </button>
      ))}
    </div>
  )
}
```

> `App.tsx` still passes the old `modules` prop at this point — that's fixed in Task 8. `npm run build` will not pass until Task 8; run the targeted test here.

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- src/components/Tabs.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Tabs.tsx src/components/Tabs.test.tsx
git commit -m "$(cat <<'EOF'
Generalize Tabs to a TabItem list with optional percent

Why: the two-tier nav renders both module tabs and a percent-less
Overview sub-tab from the same component.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 7: `AnalyzersOverview` component

**Files:**
- Create: `src/components/AnalyzersOverview.tsx`
- Test: `src/components/AnalyzersOverview.test.tsx`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `globalAnalyzerPercent`, `ProgressBar`, `Module`, `Status`.
- Produces: `AnalyzersOverview({ analyzers, onSelect }: { analyzers: Module[]; onSelect: (key: string) => void })` — a global-readiness card plus one clickable card per analyzer; clicking calls `onSelect(key)`.

- [ ] **Step 1: Write the failing test**

Create `src/components/AnalyzersOverview.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AnalyzersOverview } from './AnalyzersOverview'
import type { Module } from '../../shared/readiness'

const analyzers = [
  { key: 'bank', name: 'Bank Statement Analyzer', percent: 67, status: 'on_track', statusLabel: 'On track', accentColor: '#123456', counts: { delivered: 2, inProgress: 0, remaining: 1 } },
  { key: 'id', name: 'ID Analyzer', percent: 0, status: 'early', statusLabel: 'Early build', counts: { delivered: 0, inProgress: 1, remaining: 2 } },
] as unknown as Module[]

test('shows the story-weighted global percent and a card per analyzer', () => {
  render(<AnalyzersOverview analyzers={analyzers} onSelect={() => {}} />)
  expect(screen.getByText('Analyzer readiness')).toBeInTheDocument()
  expect(screen.getByText('33')).toBeInTheDocument() // 2 / 6
  expect(screen.getByText('Bank Statement Analyzer')).toBeInTheDocument()
  expect(screen.getByText('ID Analyzer')).toBeInTheDocument()
})

test('clicking a card selects that analyzer', async () => {
  const onSelect = vi.fn()
  render(<AnalyzersOverview analyzers={analyzers} onSelect={onSelect} />)
  await userEvent.click(screen.getByText('ID Analyzer'))
  expect(onSelect).toHaveBeenCalledWith('id')
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/components/AnalyzersOverview.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/components/AnalyzersOverview.tsx`**

```tsx
import type { Module, Status } from '../../shared/readiness'
import { ProgressBar } from './ProgressBar'
import { globalAnalyzerPercent } from '../lib/analyzers'

const PILL: Record<Status, string> = {
  on_track: 'green',
  in_progress: 'blue',
  early: 'grey',
  at_risk: 'amber',
  blocked: 'red',
}

export function AnalyzersOverview({ analyzers, onSelect }: {
  analyzers: Module[]
  onSelect: (key: string) => void
}) {
  const pct = globalAnalyzerPercent(analyzers)
  return (
    <div className="panel active" role="tabpanel">
      <div className="card">
        <div className="label">Analyzer readiness</div>
        <div><span className="bignum">{pct}<span className="unit">%</span></span></div>
        <ProgressBar percent={pct} />
        <div className="note">Combined across {analyzers.length} analyzers.</div>
      </div>
      <div className="analyzer-grid">
        {analyzers.map((m) => (
          <button
            key={m.key}
            type="button"
            className="analyzer-card"
            onClick={() => onSelect(m.key)}
            style={m.accentColor ? { borderLeftColor: m.accentColor } : undefined}
          >
            <div className="ac-name">{m.name}</div>
            <div>
              <span className="ac-pct">{m.percent}%</span>
              <span className={`pill ${PILL[m.status]}`}>{m.statusLabel}</span>
            </div>
            <ProgressBar percent={m.percent} color={m.accentColor} />
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add styles to `src/styles/app.css`**

Append:

```css
  .analyzer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; margin-top: 14px; }
  .analyzer-card { text-align: left; background: #fff; border: 1px solid #E3EAF2; border-left: 4px solid #C9D6E6; border-radius: 14px; padding: 16px 18px; cursor: pointer; font: inherit; }
  .analyzer-card:hover { border-color: #B9CBE2; }
  .analyzer-card .ac-name { font-size: 14px; font-weight: 600; color: #0B1F3A; margin-bottom: 8px; }
  .analyzer-card .ac-pct { font-size: 24px; font-weight: 600; color: #0B1F3A; margin-right: 8px; }
  .subnav { margin-top: -8px; }
```

- [ ] **Step 5: Run test — expect PASS**

Run: `npm test -- src/components/AnalyzersOverview.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/AnalyzersOverview.tsx src/components/AnalyzersOverview.test.tsx src/styles/app.css
git commit -m "$(cat <<'EOF'
Add AnalyzersOverview: global readiness plus per-analyzer cards

Why: the Analyzers section needs a combined overview that rolls up all
analyzers and lets the user drill into one.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 8: App — two-tier navigation

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: `partitionModules`, `globalAnalyzerPercent`, `Tabs`/`TabItem`, `DeliveryPanel`, `AnalyzersOverview`.

- [ ] **Step 1: Rewrite the navigation test**

In `src/App.test.tsx`, replace the first test (keep the `'shows an error card'` test as-is):

```tsx
test('renders the first module, then navigates into the Analyzers section', async () => {
  render(<App />)
  await waitFor(() => expect(screen.getAllByText('Pricing & Eligibility')).toHaveLength(2))
  await userEvent.click(screen.getByRole('tab', { name: /Analyzers/ }))
  await waitFor(() => expect(screen.getByText('Analyzer readiness')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('tab', { name: /Bank Statement Analyzer/ }))
  await waitFor(() => expect(screen.getAllByText('Bank Statement Analyzer')).toHaveLength(2))
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL (no Analyzers tab / overview yet).

- [ ] **Step 3: Rewrite `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { ReadinessPayload } from '../shared/readiness'
import { fetchReadiness } from './api'
import { Masthead } from './components/Masthead'
import { Tabs } from './components/Tabs'
import type { TabItem } from './components/Tabs'
import { DeliveryPanel } from './components/DeliveryPanel'
import { AnalyzersOverview } from './components/AnalyzersOverview'
import { partitionModules, globalAnalyzerPercent } from './lib/analyzers'

const ANALYZERS_SECTION = 'analyzers'
const OVERVIEW = 'overview'

export default function App() {
  const [payload, setPayload] = useState<ReadinessPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [activeAnalyzer, setActiveAnalyzer] = useState<string>(OVERVIEW)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadiness(ctrl.signal)
      .then((p) => {
        setPayload(p)
        setActiveSection(p.modules[0]?.key ?? null)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => ctrl.abort()
  }, [])

  if (error) {
    return <div className="wrap"><div className="card">Could not load the console: {error}</div></div>
  }
  if (!payload || !activeSection) {
    return <div className="wrap"><div className="card">Loading…</div></div>
  }

  const { delivery, analyzers } = partitionModules(payload.modules)
  const topItems: TabItem[] = [
    ...delivery.map((m) => ({ key: m.key, name: m.name, percent: m.percent })),
    { key: ANALYZERS_SECTION, name: 'Analyzers', percent: globalAnalyzerPercent(analyzers) },
  ]
  const subItems: TabItem[] = [
    { key: OVERVIEW, name: 'Overview' },
    ...analyzers.map((m) => ({ key: m.key, name: m.name, percent: m.percent })),
  ]
  const deliveryActive = delivery.find((m) => m.key === activeSection)
  const analyzerActive = analyzers.find((m) => m.key === activeAnalyzer)

  return (
    <div className="wrap">
      <Masthead asOf={payload.asOf} />
      <Tabs items={topItems} activeKey={activeSection} onSelect={setActiveSection} />
      {activeSection === ANALYZERS_SECTION ? (
        <>
          <div className="subnav">
            <Tabs items={subItems} activeKey={activeAnalyzer} onSelect={setActiveAnalyzer} />
          </div>
          {activeAnalyzer !== OVERVIEW && analyzerActive ? (
            <DeliveryPanel module={analyzerActive} />
          ) : (
            <AnalyzersOverview analyzers={analyzers} onSelect={setActiveAnalyzer} />
          )}
        </>
      ) : deliveryActive ? (
        <DeliveryPanel module={deliveryActive} />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full typecheck + build (all wiring now consistent)**

Run: `npm run build`
Expected: `tsc -b` clean, Vite build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "$(cat <<'EOF'
Reshape the SPA into modules + an Analyzers section

Why: five analyzers plus an overview don't fit a flat tab bar. Top level
shows the delivery modules and an Analyzers tab; entering it reveals an
Overview and one sub-tab per analyzer.

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

---

### Task 9: Full verification, ledger, deploy prep

**Files:**
- Modify: `docs/superpowers/reports/sdd-progress-ledger.md`

- [ ] **Step 1: Run the full suite**

Run: `npm test`
Expected: all suites pass (shared, api/_lib, api, src). Confirm `api/import-extensions.test.ts` and `src/styles/styles.test.ts` are green.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Live smoke — verify the prod token can read the new boards**

This is the pre-deploy check called out in the spec. With prod env available locally (or against a preview deploy), exercise the cron endpoint and confirm a 200 with 9 modules and that the analyzer modules are `assumed: false` (i.e. the token could read the dedicated boards). Example against a running/preview instance:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "$BASE_URL/api/refresh" | npx --yes json | head -40
```

Expected: `{ "ok": true, "modules": 9, "builtAt": "…" }`. Then:

```bash
curl -s "$BASE_URL/api/readiness" | npx --yes json 'modules' | grep -E '"key"|"assumed"'
```

Expected: `bank`, `id`, `pl`, `paystub` present; not all `assumed: true` (if the token lacks board access, `fetchBoardStories` throws → `/api/refresh` returns 500 and the blob is left untouched — that is the failure signal to fix token/board permissions before merge).

If you cannot run this locally, record it as a manual deploy-time check and do not claim the task complete until it passes.

- [ ] **Step 4: Update the SDD ledger**

Append to `docs/superpowers/reports/sdd-progress-ledger.md`:

```markdown
## 2026-07-08 — Per-analyzer Monday boards + Analyzers overview

- Bank/ID/P&L/Paystub each read a dedicated Monday board (whole board = one
  analyzer, no module routing); env-overridable ids.
- Tax unchanged: shared board 18403908550, module='Tax Analyzer'.
- Added P&L and Paystub analyzer modules; payload now 9 modules.
- SPA nav is two-tier: delivery modules + an Analyzers section with an
  Overview (story-weighted global %) and one sub-tab per analyzer.
- Spec: docs/superpowers/specs/2026-07-08-analyzer-boards-overview-design.md
- Deploy check: confirmed the prod MONDAY_API_TOKEN can read the four new
  boards via a /api/refresh 200 (or noted as pending manual verification).
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/reports/sdd-progress-ledger.md
git commit -m "$(cat <<'EOF'
Record the analyzer-boards revamp in the SDD ledger

Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV
EOF
)"
```

- [ ] **Step 6: Finish the branch**

Use `superpowers:finishing-a-development-branch` (capped at push + PR + handoff). Do not merge to `develop`/`main` without explicit user confirmation.

---

## Self-Review

**Spec coverage:**
- Dedicated boards for Bank/ID/P&L/Paystub → Tasks 2, 3, 4. ✅
- Two new modules (pl, paystub) → Task 1. ✅
- Tax kept on shared board via module label → Task 3 (`buildTaxModule`). ✅
- Combined Analyzers overview (story-weighted %) → Tasks 5, 7. ✅
- Two-tier navigation → Tasks 6, 8. ✅
- pe/vt/uw/lexi untouched → verified by unchanged delivery rollup + `partitionModules`. ✅
- Env vars documented → Task 2 (`.env.example`). ✅
- Token-access pre-deploy check → Task 9, Step 3. ✅
- Sparse-data caveat → informational only (no code); noted in spec. ✅
- Dedicated boards read whole (no module routing), quirky `module` column ignored → Task 3 test `'dedicated analyzer stories count regardless of the module column'`. ✅

**Placeholder scan:** none — every step carries real code/commands. The one env-dependent step (Task 9, Step 3) has an explicit fallback (record as manual check).

**Type consistency:** `assembleLivePayload(deliveryStories, dedicated, taxStories, now)` used identically in Tasks 3 (def/tests) and 4 (caller). `TabItem { key, name, percent? }` used in Tasks 6, 8. `getDedicatedAnalyzerBoardId(key)` defined in Task 2, called in Task 4. `globalAnalyzerPercent` / `partitionModules` defined in Task 5, used in Tasks 7, 8. `ANALYZER_KEYS` defined in Task 1 (shared), re-exported in Task 2 (config), imported in Task 5 (frontend). Consistent.
