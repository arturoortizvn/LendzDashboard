### Task 3: Data contract types + fixture + buildPayload

**Files:**
- Create: `shared/readiness.ts`
- Test: `shared/readiness.test.ts`

**Interfaces:**
- Produces: types `ReadinessPayload`, `Module`, `DeliveryModule`, `MeasurementModule`, `BucketItem`, `Metric`, `Status`, `DateConfidence`; const `MODULES: Module[]`; function `buildPayload(now: string): ReadinessPayload`.

- [ ] **Step 1: Create the types and skeleton in `shared/readiness.ts`**

```ts
export interface ReadinessPayload {
  asOf: string
  modules: Module[]
}

export type Module = DeliveryModule | MeasurementModule
export type Status = 'on_track' | 'in_progress' | 'early' | 'at_risk' | 'blocked'
export type DateConfidence = 'committed' | 'projected'

export interface BucketItem {
  title: string
  detail?: string
  weight?: number
}

export interface DeliveryModule {
  key: string
  name: string
  sub: string
  phase: 'delivery'
  percent: number
  status: Status
  statusLabel: string
  note: string
  targetDate: string
  dateConfidence: DateConfidence
  assumed: boolean
  assumedLabel?: string
  accentColor?: string
  counts: { delivered: number; inProgress: number; remaining: number }
  buckets: {
    delivered: BucketItem[]
    inProgress: BucketItem[]
    remaining: BucketItem[]
  }
}

export interface Metric {
  capability: string
  weight: number
  current: string
  target: string
  status: 'at_target' | 'near' | 'blocked' | 'no_target'
  statusLabel: string
}

export interface MeasurementModule {
  key: 'bank'
  name: string
  sub: string
  phase: 'measurement'
  percent: number
  status: Status
  statusLabel: string
  note: string
  targetDate: string
  dateConfidence: DateConfidence
  capabilitiesAtStandard: { count: number; of: number }
  composite: { value: number; denominator: number; costExcluded: boolean }
  gapNote: string
  metrics: Metric[]
  buckets: {
    achieved: BucketItem[]
    holding: BucketItem[]
    mustComplete: BucketItem[]
  }
}

export function buildPayload(now: string): ReadinessPayload {
  return { asOf: now, modules: MODULES }
}
```

- [ ] **Step 2: Add the `bank` (measurement) module fully — append to `shared/readiness.ts`**

```ts
const bank: MeasurementModule = {
  key: 'bank',
  name: 'Bank Statement Analyzer',
  sub: 'Production-readiness measurement across six capabilities.',
  phase: 'measurement',
  percent: 77,
  status: 'on_track',
  statusLabel: 'On track',
  note: 'Weighted across five scored capabilities by business impact. Reads accuracy heaviest.',
  targetDate: '~6 July',
  dateConfidence: 'projected',
  capabilitiesAtStandard: { count: 4, of: 6 },
  composite: { value: 77, denominator: 97, costExcluded: true },
  gapNote:
    'We are 23 points from 100: one capability is fully blocked and scoring zero (20 pts), two are a hair under target (~2 pts), and cost is parked until finance sets a baseline.',
  metrics: [
    { capability: 'Reads statements correctly', weight: 30, current: '93.8%', target: '95%', status: 'at_target', statusLabel: 'At target' },
    { capability: 'Catches problems a human would', weight: 25, current: '91% / 82%', target: '90% / 80%', status: 'at_target', statusLabel: 'At target' },
    { capability: 'Output the system trusts', weight: 20, current: 'Not emitted', target: '70%', status: 'blocked', statusLabel: 'Blocked' },
    { capability: 'Handles statement variety', weight: 15, current: '78%', target: '85%', status: 'near', statusLabel: 'Near' },
    { capability: 'Fast enough for the workflow', weight: 7, current: 'p95 99s', target: 'p95 < 90s', status: 'near', statusLabel: 'Near' },
    { capability: 'Economical at scale', weight: 3, current: 'Measured / TBD', target: 'TBD', status: 'no_target', statusLabel: 'No target' },
  ],
  buckets: {
    achieved: [],     // populate from PoC bank panel, "Achieved" bucket
    holding: [],      // populate from PoC bank panel, "Holding" bucket
    mustComplete: [], // populate from PoC bank panel, "Must complete" bucket
  },
}
```

For the three bank buckets, copy each `<div class="item">…</div>`'s bold lead as `title` and the trailing sentence as `detail` from the bank panel in `LendLogic_Readiness_Console.html` (panel starts at line 264).

- [ ] **Step 3: Add the six delivery modules — append to `shared/readiness.ts`**

Define `pe`, `vt`, `uw`, `lexi`, `id`, `tax` as `DeliveryModule` objects with the top-level fields below, then populate each module's `counts` and `buckets` items by copying verbatim from the matching PoC panel (`pe` line 149, `vt` line 180, `uw` line 208, `lexi` line 236, `id` line 311, `tax` line 336). For each `<div class="item"><b>Lead.</b> rest</div>`, set `title` to the bold lead and `detail` to the rest. Read each panel's `.bcount` to fill `counts`.

```ts
const pe: DeliveryModule = {
  key: 'pe', name: 'Pricing & Eligibility', sub: 'Pricing engine, eligibility evaluation, product and rules catalogs.',
  phase: 'delivery', percent: 71, status: 'on_track', statusLabel: 'On track',
  note: '53 of 75 tracked stories accepted. The most mature module on the program.',
  targetDate: '11 July', dateConfidence: 'committed', assumed: false,
  counts: { delivered: 53, inProgress: 0, remaining: 0 }, // fix inProgress/remaining from PoC .bcount
  buckets: { delivered: [], inProgress: [], remaining: [] }, // populate from PoC line 149
}

const vt: DeliveryModule = {
  key: 'vt', name: 'Verified Truth', sub: 'Governed, evidence-backed loan state. Currently defining the data model and integration contract.',
  phase: 'delivery', percent: 55, status: 'in_progress', statusLabel: 'In design',
  note: 'Data model and integration contract substantially in place. The governed lifecycle is the remaining build. Figures assumed.',
  targetDate: '6 July', dateConfidence: 'committed', assumed: true, assumedLabel: 'Architecture phase', accentColor: '#7A5FD0',
  counts: { delivered: 0, inProgress: 0, remaining: 0 }, // from PoC line 180
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const uw: DeliveryModule = {
  key: 'uw', name: 'Underwriting', sub: 'Framework, core analyzers, verification center.',
  phase: 'delivery', percent: 69, status: 'on_track', statusLabel: 'On track',
  note: '9 of 13 framework stories accepted. Core analyzer plumbing is live.',
  targetDate: 'mid-August', dateConfidence: 'committed', assumed: false, accentColor: '#1E8E7E',
  counts: { delivered: 9, inProgress: 0, remaining: 0 }, // from PoC line 208
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const lexi: DeliveryModule = {
  key: 'lexi', name: 'Lexi Intelligence', sub: 'Agent orchestration and Generative UI. v1 is back online answering questions from pricing data.',
  phase: 'delivery', percent: 55, status: 'in_progress', statusLabel: 'In progress',
  note: '11 of 20 stories accepted. v1 orchestration and the Generative UI kit are live.',
  targetDate: '6 July', dateConfidence: 'committed', assumed: false, accentColor: '#C77DBB',
  counts: { delivered: 11, inProgress: 0, remaining: 0 }, // from PoC line 236
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const id: DeliveryModule = {
  key: 'id', name: 'ID Analyzer', sub: 'Identity document extraction and validation.',
  phase: 'delivery', percent: 30, status: 'early', statusLabel: 'Early build',
  note: 'Inherits the live analyzer framework. Identity-specific extraction and validation ahead. Figures assumed.',
  targetDate: '1 July', dateConfidence: 'committed', assumed: true, accentColor: '#E0913B',
  counts: { delivered: 0, inProgress: 0, remaining: 0 }, // from PoC line 311
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

const tax: DeliveryModule = {
  key: 'tax', name: 'Tax Docs Analyzer', sub: 'Tax form extraction. Planned for Release Two.',
  phase: 'delivery', percent: 30, status: 'early', statusLabel: 'Early build',
  note: 'Framework scaffolding in place. Form-specific extraction is the bulk of the work, planned for Release Two. Figures assumed.',
  targetDate: '3 July', dateConfidence: 'committed', assumed: true, accentColor: '#5A8FB5',
  counts: { delivered: 0, inProgress: 0, remaining: 0 }, // from PoC line 336
  buckets: { delivered: [], inProgress: [], remaining: [] },
}

export const MODULES: Module[] = [pe, vt, uw, lexi, bank, id, tax]
```

- [ ] **Step 4: Write the failing test `shared/readiness.test.ts`**

```ts
import { MODULES, buildPayload } from './readiness'

test('exposes seven modules in PoC tab order', () => {
  expect(MODULES.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'tax'])
})

test('flags exactly the assumed modules', () => {
  const assumed = MODULES.filter((m) => m.phase === 'delivery' && m.assumed).map((m) => m.key)
  expect(assumed.sort()).toEqual(['id', 'tax', 'vt'])
})

test('bank is the only measurement module and carries the 77 composite', () => {
  const bank = MODULES.find((m) => m.key === 'bank')!
  expect(bank.phase).toBe('measurement')
  if (bank.phase === 'measurement') {
    expect(bank.composite).toEqual({ value: 77, denominator: 97, costExcluded: true })
    expect(bank.metrics).toHaveLength(6)
  }
})

test('buildPayload stamps asOf and returns the modules', () => {
  const p = buildPayload('2026-06-17T14:00:00Z')
  expect(p.asOf).toBe('2026-06-17T14:00:00Z')
  expect(p.modules).toBe(MODULES)
})
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- readiness`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add readiness data contract, fixture, and buildPayload"
```

---

