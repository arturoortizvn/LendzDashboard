# Resilient per-module boards — Implementation Plan

> Executed inline with TDD (tightly-coupled backend refactor). Spec:
> docs/superpowers/specs/2026-07-08-refresh-resilient-per-module-boards-design.md

**Goal:** Repoint every dashboard module at its own dedicated Monday board (read whole, no `module` routing), make `/api/refresh` resilient to a failed/missing board, and hide modules whose board does not exist yet (vt/lexi/tax).

## Global Constraints
- `api/**` uses `.js` import extensions; `src/**` none.
- English identifiers; no comments except a one-line *why*.
- TDD red→green; commit per task; trailer `Claude-Session: https://claude.ai/code/session_019JNqg7yarru4ML7c2Y9JKV`.
- Visible modules now: `pe, uw, bank, id, pl, paystub`. Hidden: `vt, lexi, tax`.
- Backend only — no `src/` changes (the SPA already renders whatever module subset the payload carries).

---

### Task 1: Config + Rollup (unified module→board map; remove routing)

**Files:** `api/_lib/config.ts`, `api/_lib/config.test.ts`, `api/_lib/rollup.ts`, `api/_lib/rollup.test.ts`

**config.ts** — new shape:
- Keep: `ModuleKey`, `ANALYZER_KEYS` re-export, `Bucket`/`STATUS_BUCKET`/`bucketForStatus`, `statusFromPercent`, `STATUS_LABELS`, `cleanTitle`, `getMondayToken`, `getCronSecret`.
- Add:
  ```ts
  export const MODULE_ORDER: readonly ModuleKey[] = ['pe','vt','uw','lexi','bank','id','pl','paystub','tax']

  const MODULE_BOARD_DEFAULTS: Record<ModuleKey, number | null> = {
    pe: 18420951236, vt: null, uw: 18420951193, lexi: null,
    bank: 18420951194, id: 18420951197, pl: 18420951201, paystub: 18420951200, tax: null,
  }
  const MODULE_BOARD_ENV: Record<ModuleKey, string> = {
    pe:'ID_MONDAY_PE', vt:'ID_MONDAY_VT', uw:'ID_MONDAY_UW', lexi:'ID_MONDAY_LEXI',
    bank:'ID_MONDAY_BANK', id:'ID_MONDAY_ID', pl:'ID_MONDAY_PL', paystub:'ID_MONDAY_PAYSTUB', tax:'ID_MONDAY_TAX',
  }
  export function getModuleBoardId(key: ModuleKey): number | null {
    const n = Number(process.env[MODULE_BOARD_ENV[key]])
    if (Number.isFinite(n) && n > 0) return n
    return MODULE_BOARD_DEFAULTS[key]
  }
  export function boardBackedKeys(): ModuleKey[] {
    return MODULE_ORDER.filter((k) => getModuleBoardId(k) != null)
  }
  ```
- Remove: `BOARD_ID`, `getBoardId`, `ANALYZER_BOARD_ID`, `getAnalyzerBoardId`, `getAnalyzerColumnId`, `DEDICATED_ANALYZER_KEYS`/`DedicatedAnalyzerKey`/`DEDICATED_ANALYZER_BOARDS`/`DEDICATED_ANALYZER_ENV`/`getDedicatedAnalyzerBoardId`, `DELIVERY_KEYS`, `FORCE_ASSUMED`, `MODULE_LABELS`, `SHARED_LABEL`, `moduleKeyForLabel`, `MODULE_COLUMN_ID`, `getModuleColumnId`.

**rollup.ts**:
- `buildDeliveryModule`: drop the `FORCE_ASSUMED.has(...)` term → `if (stories.length === 0)`.
- Replace `assembleLivePayload`:
  ```ts
  export function assembleLivePayload(
    storiesByModule: Partial<Record<ModuleKey, RawStory[]>>,
    now: string,
  ): ReadinessPayload {
    const modules: Module[] = boardBackedKeys().map((k) => buildDeliveryModule(k, storiesByModule[k] ?? []))
    return { asOf: now, builtAt: now, source: 'live', modules }
  }
  ```
- Remove `buildDeliveryModules`, `buildModulesForKeys`, `buildTaxModule`, `TAX_ONLY`. Update imports (drop `DELIVERY_KEYS`, `FORCE_ASSUMED`, `moduleKeyForLabel`, `SHARED_LABEL`, `DedicatedAnalyzerKey`; add `boardBackedKeys`).

**config.test.ts**: remove tests for removed exports; keep `bucketForStatus`, `statusFromPercent`, `cleanTitle`, `ANALYZER_KEYS`. Add:
```ts
test('getModuleBoardId: default, env override, invalid falls back', () => {
  const orig = process.env.ID_MONDAY_PE
  delete process.env.ID_MONDAY_PE
  expect(getModuleBoardId('pe')).toBe(18420951236)
  process.env.ID_MONDAY_PE = 'x'; expect(getModuleBoardId('pe')).toBe(18420951236)
  process.env.ID_MONDAY_PE = '999'; expect(getModuleBoardId('pe')).toBe(999)
  process.env.ID_MONDAY_PE = orig
})
test('getModuleBoardId is null for boardless modules', () => {
  for (const k of ['vt','lexi','tax'] as const) expect(getModuleBoardId(k)).toBeNull()
})
test('boardBackedKeys are the six board-backed modules in order', () => {
  expect(boardBackedKeys()).toEqual(['pe','uw','bank','id','pl','paystub'])
})
```

**rollup.test.ts**: rewrite `assembleLivePayload` tests + keep/trim `buildDeliveryModule` tests:
```ts
test('assembleLivePayload emits only board-backed modules in order, source live', () => {
  const p = assembleLivePayload({}, '2026-07-08T00:00:00Z')
  expect(p.modules.map((m) => m.key)).toEqual(['pe','uw','bank','id','pl','paystub'])
  expect(p.source).toBe('live')
  expect(p.builtAt).toBe('2026-07-08T00:00:00Z')
})
test('a module with stories goes live; a board-backed module with none is assumed', () => {
  const p = assembleLivePayload({ pe: [{ name: 'X', status: 'Done', module: null }] }, 'now')
  expect(p.modules.find((m) => m.key === 'pe')!.assumed).toBe(false)
  expect(p.modules.find((m) => m.key === 'uw')!.assumed).toBe(true)
})
test('boardless modules never appear', () => {
  const p = assembleLivePayload({}, 'now')
  for (const k of ['vt','lexi','tax']) expect(p.modules.find((m) => m.key === k)).toBeUndefined()
})
```
Keep the `buildDeliveryModule` "rolls up counts…" and "no stories → assumed baseline" tests. Remove `buildTaxModule`/`buildDeliveryModules`/routing tests.

**Verify:** `npm test -- api/_lib/config.test.ts api/_lib/rollup.test.ts` green. (refresh.ts/readiness.ts won't compile until Tasks 2-3 — expected.) Commit.

---

### Task 2: Refresh resilience

**Files:** `api/refresh.ts`, `api/refresh.test.ts`

**refresh.ts**:
```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchBoardStories } from './_lib/monday.js'
import type { RawStory } from './_lib/monday.js'
import { assembleLivePayload } from './_lib/rollup.js'
import { writeLatest } from './_lib/blob.js'
import { boardBackedKeys, getCronSecret, getModuleBoardId, getMondayToken, type ModuleKey } from './_lib/config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${getCronSecret()}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const token = getMondayToken()
    const keys = boardBackedKeys()
    const results = await Promise.all(
      keys.map((k) =>
        fetchBoardStories({ token, boardId: getModuleBoardId(k)!, statusColumnId: 'task_status' })
          .then((stories) => ({ k, stories: stories as RawStory[] | null }))
          .catch(() => ({ k, stories: null as RawStory[] | null })),
      ),
    )
    if (results.every((r) => r.stories === null)) {
      return res.status(500).json({ error: 'all Monday board fetches failed' })
    }
    const storiesByModule: Partial<Record<ModuleKey, RawStory[]>> = {}
    for (const r of results) if (r.stories !== null) storiesByModule[r.k] = r.stories
    const payload = assembleLivePayload(storiesByModule, new Date().toISOString())
    await writeLatest(payload)
    return res.status(200).json({ ok: true, modules: payload.modules.length, builtAt: payload.builtAt })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
```

**refresh.test.ts**: keep 401 test. Replace others:
```ts
test('fetches every board-backed board with task_status, assembles, writes, 200', async () => {
  vi.mocked(fetchBoardStories).mockResolvedValue([{ name: 'X', status: 'Done', module: null }])
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as any, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  expect(fetchBoardStories).toHaveBeenCalledTimes(6)
  const calls = vi.mocked(fetchBoardStories).mock.calls.map((c) => c[0])
  const boardIds = calls.map((c) => c.boardId)
  expect(boardIds).toEqual(expect.arrayContaining([18420951236,18420951193,18420951194,18420951197,18420951201,18420951200]))
  for (const c of calls) expect(c.statusColumnId).toBe('task_status')
  expect(writeLatest).toHaveBeenCalledTimes(1)
})
test('one board failing still writes; that module falls back, others live', async () => {
  vi.mocked(fetchBoardStories).mockImplementation(({ boardId }: any) =>
    boardId === 18420951193 ? Promise.reject(new Error('gone')) : Promise.resolve([{ name: 'X', status: 'Done', module: null }]))
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as any, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  expect(writeLatest).toHaveBeenCalledTimes(1)
  const payload = vi.mocked(writeLatest).mock.calls[0][0] as any
  expect(payload.modules.find((m: any) => m.key === 'uw').assumed).toBe(true)
  expect(payload.modules.find((m: any) => m.key === 'pe').assumed).toBe(false)
})
test('all boards failing returns 500 and does NOT write', async () => {
  vi.mocked(fetchBoardStories).mockRejectedValue(new Error('Monday down'))
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer secret' } } as any, res as VercelResponse)
  expect(res.statusCode).toBe(500)
  expect(writeLatest).not.toHaveBeenCalled()
})
```
Drop the old `beforeEach` env for ID_MONDAY/ID_MONDAY_ANALYZERS/MONDAY_MODULE_COLUMN_ID (defaults now apply); keep CRON_SECRET + MONDAY_API_TOKEN.

**Verify:** `npm test -- api/refresh.test.ts` green. Commit.

---

### Task 3: Readiness baseline filter + env docs

**Files:** `api/readiness.ts`, `api/readiness.test.ts`, `.env.example`

**readiness.ts**:
```ts
import { boardBackedKeys } from './_lib/config.js'
// ...
  const latest = await readLatest()
  if (latest) { res.status(200).json(latest); return }
  const baseline = buildPayload(new Date().toISOString())
  const visible = new Set<string>(boardBackedKeys())
  res.status(200).json({ ...baseline, modules: baseline.modules.filter((m) => visible.has(m.key)) })
```
(Cache-Control header unchanged.)

**readiness.test.ts**: the blob-present test still passes through verbatim (adjust its module count to whatever the mocked blob carries — use `buildPayload` filtered, or keep a 9-module mock and assert passthrough length equals the mock's). Baseline test:
```ts
test('baseline fallback contains only board-backed modules', () => {
  vi.mocked(readLatest).mockResolvedValue(null)
  // ...
  expect(body.modules.map((m:any)=>m.key)).toEqual(['pe','uw','bank','id','pl','paystub'])
  expect(body.source).toBe('baseline')
})
```
For the blob-present test, mock `readLatest` to resolve a live payload built from the new `assembleLivePayload({}, ...)` (6 modules) so it asserts passthrough of exactly what the blob holds.

**.env.example**: replace the old board-id lines with the per-module set:
```
# One dedicated Monday board per module (blank/absent = module hidden until its board exists)
ID_MONDAY_PE=18420951236
ID_MONDAY_UW=18420951193
ID_MONDAY_BANK=18420951194
ID_MONDAY_ID=18420951197
ID_MONDAY_PL=18420951201
ID_MONDAY_PAYSTUB=18420951200
# ID_MONDAY_VT=   # set when the Verified Truth board exists
# ID_MONDAY_LEXI= # set when the Lexi board exists
# ID_MONDAY_TAX=  # set when the Tax board exists
```
Remove `ID_MONDAY`, `ID_MONDAY_ANALYZERS`, `MONDAY_MODULE_COLUMN_ID`, `MONDAY_ANALYZER_COLUMN_ID`.

**Verify:** `npm test` (full suite) green + `npm run build` clean. Commit.

---

### Task 4: Verify, ledger, finish
- Full `npm test` + `npm run build`.
- Append ledger entry to `docs/superpowers/reports/sdd-progress-ledger.md`.
- Final code review (subagent) of the whole branch diff.
- finishing-a-development-branch (merge per user's develop-implicit / main-explicit rule).
