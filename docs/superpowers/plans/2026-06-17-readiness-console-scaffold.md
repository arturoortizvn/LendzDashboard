# Readiness Console v1 Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static PoC into a Vite + React + TypeScript SPA that renders all seven LendLogic module tabs from a Vercel serverless endpoint `GET /api/readiness` returning a static fixture.

**Architecture:** One repo, one Vercel deploy. The browser fetches `/api/readiness`; a thin serverless function returns a typed `ReadinessPayload` (static fixture in v1). The frontend is a dumb renderer: a discriminated union on `phase` ("delivery" | "measurement") picks the panel template. Phase 2 (live Monday + DB) and phase 3 (auth) are out of scope.

**Tech Stack:** Vite 6, React 19, TypeScript 5.6, Vitest 3 + React Testing Library 16 (jsdom), @vercel/node for the function, deploy on Vercel.

## Global Constraints

- Language: code, identifiers, comments, and commit messages in **English**. No code comments unless they explain a non-obvious *why* (one line max).
- Styling is **ported verbatim** from `LendLogic_Readiness_Console.html` — do not redesign. Preserve class names so the CSS applies unchanged.
- Data contract lives in `shared/readiness.ts` and is imported by both `api/` and the frontend. The browser only receives the payload over HTTP.
- Fixture content (CSS, bucket item text, per-bucket counts) is **copied from the committed PoC** `LendLogic_Readiness_Console.html`, not invented.
- No secrets committed. `*.pdf` and `Meeting_Notes_*.md` stay gitignored.
- Work only on branch `feature/scaffold-readiness-console`. Never commit to `main`/`develop`.
- TDD: red → green → refactor. Commit after each green task.

---

### Task 1: Project scaffold + test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `src/test/setup.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `App` (default export, React component); npm scripts `dev`, `build`, `preview`, `test`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "lendz-dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vercel/node": "^3.2.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "shared", "api"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LendLogic — Delivery Readiness Console</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 7: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 8: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 9: Create placeholder `src/App.tsx`**

```tsx
export default function App() {
  return <div className="wrap">LendLogic Readiness Console</div>
}
```

- [ ] **Step 10: Write the failing smoke test `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the console shell', () => {
  render(<App />)
  expect(screen.getByText(/LendLogic Readiness Console/i)).toBeInTheDocument()
})
```

- [ ] **Step 11: Install deps and run the test**

Run: `npm install && npm test`
Expected: PASS (1 test). If `npm install` fails on a version, relax the offending caret range to the latest published and retry.

- [ ] **Step 12: Verify dev server boots**

Run: `npm run dev` (then Ctrl-C)
Expected: Vite serves on localhost with no errors.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + React + TS project with Vitest harness"
```

---

### Task 2: Port PoC styles

**Files:**
- Create: `src/styles/app.css`
- Modify: `src/main.tsx` (import the stylesheet)
- Test: `src/styles/styles.test.ts`

**Interfaces:**
- Produces: global stylesheet applying the PoC look via the original class names.

- [ ] **Step 1: Create `src/styles/app.css` by copying the PoC `<style>` block**

Copy the entire contents between `<style>` and `</style>` in `LendLogic_Readiness_Console.html` (lines 7–135) verbatim into `src/styles/app.css` (without the `<style>`/`</style>` tags). Append one rule for the assumed badge and weight chip if not already present:

```css
.assumed { display:inline-block; font-size:11px; font-weight:600; color:#8A5A00; background:#FFF3DD; padding:2px 8px; border-radius:999px; margin-left:8px; vertical-align:middle; }
.wt { display:inline-block; font-size:11px; font-weight:700; color:#3F5874; background:#EDF1F6; padding:1px 7px; border-radius:999px; margin-left:7px; }
```

- [ ] **Step 2: Import the stylesheet in `src/main.tsx`**

Add as the first import:

```tsx
import './styles/app.css'
```

- [ ] **Step 3: Write the failing test `src/styles/styles.test.ts`**

```ts
import { readFileSync } from 'node:fs'

test('app.css contains the core PoC classes', () => {
  const css = readFileSync(new URL('./app.css', import.meta.url), 'utf8')
  for (const cls of ['.masthead', '.tabs', '.panel', '.modband', '.bucket', '.bignum', '.fill']) {
    expect(css).toContain(cls)
  }
})
```

- [ ] **Step 4: Run the test**

Run: `npm test -- styles`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Port PoC stylesheet into the React app"
```

---

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

### Task 4: Serverless function + Vercel config

**Files:**
- Create: `api/readiness.ts`, `vercel.json`
- Test: `api/readiness.test.ts`

**Interfaces:**
- Consumes: `buildPayload` from `shared/readiness`.
- Produces: default Vercel handler serving the payload at `/api/readiness`.

- [ ] **Step 1: Create `api/readiness.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPayload } from '../shared/readiness'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
  res.status(200).json(buildPayload(new Date().toISOString()))
}
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "rewrites": [{ "source": "/((?!api/).*)", "destination": "/index.html" }],
  "headers": [
    { "source": "/(.*)", "headers": [{ "key": "X-Robots-Tag", "value": "noindex" }] }
  ]
}
```

- [ ] **Step 3: Write the failing test `api/readiness.test.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from './readiness'

function mockRes() {
  const res: Partial<VercelResponse> & { body?: unknown; statusCode?: number; headers: Record<string, string> } = {
    headers: {},
    setHeader(k: string, v: string) { this.headers[k] = v; return this as VercelResponse },
    status(code: number) { this.statusCode = code; return this as VercelResponse },
    json(payload: unknown) { this.body = payload; return this as VercelResponse },
  }
  return res
}

test('returns a 200 payload with asOf and seven modules', () => {
  const res = mockRes()
  handler({} as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { asOf: string; modules: unknown[] }
  expect(typeof body.asOf).toBe('string')
  expect(body.modules).toHaveLength(7)
  expect(res.headers['Cache-Control']).toContain('s-maxage')
})
```

- [ ] **Step 4: Run the test**

Run: `npm test -- api/readiness`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add /api/readiness serverless function and Vercel config"
```

---

### Task 5: API client

**Files:**
- Create: `src/api.ts`
- Test: `src/api.test.ts`

**Interfaces:**
- Consumes: `ReadinessPayload` type from `shared/readiness`.
- Produces: `fetchReadiness(signal?: AbortSignal): Promise<ReadinessPayload>`.

- [ ] **Step 1: Create `src/api.ts`**

```ts
import type { ReadinessPayload } from '../shared/readiness'

export async function fetchReadiness(signal?: AbortSignal): Promise<ReadinessPayload> {
  const res = await fetch('/api/readiness', { signal })
  if (!res.ok) {
    throw new Error(`Failed to load readiness data (${res.status})`)
  }
  return (await res.json()) as ReadinessPayload
}
```

- [ ] **Step 2: Write the failing test `src/api.test.ts`**

```ts
import { afterEach, expect, test, vi } from 'vitest'
import { fetchReadiness } from './api'

afterEach(() => vi.unstubAllGlobals())

test('returns the parsed payload on success', async () => {
  const payload = { asOf: 'x', modules: [] }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }))
  await expect(fetchReadiness()).resolves.toEqual(payload)
})

test('throws on non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
  await expect(fetchReadiness()).rejects.toThrow(/500/)
})
```

- [ ] **Step 3: Run the test**

Run: `npm test -- src/api`
Expected: PASS (2 tests).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add typed readiness API client"
```

---

### Task 6: Leaf components — AssumedBadge, ProgressBar, InfoTooltip

**Files:**
- Create: `src/components/AssumedBadge.tsx`, `src/components/ProgressBar.tsx`, `src/components/InfoTooltip.tsx`
- Test: `src/components/leaf.test.tsx`

**Interfaces:**
- Produces: `AssumedBadge({ text })`, `ProgressBar({ percent, color? })`, `InfoTooltip({ children, flipLeft? })`.

- [ ] **Step 1: Create `src/components/AssumedBadge.tsx`**

```tsx
export function AssumedBadge({ text }: { text: string }) {
  return <span className="assumed">{text}</span>
}
```

- [ ] **Step 2: Create `src/components/ProgressBar.tsx`**

```tsx
import { useEffect, useState } from 'react'

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setWidth(percent))
    return () => cancelAnimationFrame(id)
  }, [percent])
  return (
    <div className="track">
      <div
        className="fill"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ width: `${width}%`, ...(color ? { background: color } : {}) }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/InfoTooltip.tsx`**

```tsx
import type { ReactNode } from 'react'

export function InfoTooltip({ children, flipLeft }: { children: ReactNode; flipLeft?: boolean }) {
  return (
    <span className={`info${flipLeft ? ' tip-left' : ''}`} tabIndex={0}>
      i<span className="tip">{children}</span>
    </span>
  )
}
```

- [ ] **Step 4: Write the failing test `src/components/leaf.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { AssumedBadge } from './AssumedBadge'
import { ProgressBar } from './ProgressBar'
import { InfoTooltip } from './InfoTooltip'

test('AssumedBadge renders its text', () => {
  render(<AssumedBadge text="Architecture phase" />)
  expect(screen.getByText('Architecture phase')).toBeInTheDocument()
})

test('ProgressBar exposes the percent via aria', () => {
  render(<ProgressBar percent={71} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '71')
})

test('InfoTooltip renders its tip content', () => {
  render(<InfoTooltip>Helpful note</InfoTooltip>)
  expect(screen.getByText('Helpful note')).toBeInTheDocument()
})
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- leaf`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add AssumedBadge, ProgressBar, InfoTooltip leaf components"
```

---

### Task 7: BucketColumn

**Files:**
- Create: `src/components/BucketColumn.tsx`
- Test: `src/components/BucketColumn.test.tsx`

**Interfaces:**
- Consumes: `BucketItem` from `shared/readiness`.
- Produces: `BucketColumn({ tone, title, count?, items })` where `tone: 'green' | 'amber' | 'grey' | 'red'`.

- [ ] **Step 1: Create `src/components/BucketColumn.tsx`**

```tsx
import type { BucketItem } from '../../shared/readiness'

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
      {count && <div className="bcount">{count}</div>}
      {items.map((it, i) => (
        <div className="item" key={i}>
          <b>
            {it.title}
            {it.weight != null && <span className="wt">{it.weight}%</span>}
          </b>
          {it.detail ? ` ${it.detail}` : ''}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test `src/components/BucketColumn.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { BucketColumn } from './BucketColumn'

test('renders title and item leads', () => {
  render(
    <BucketColumn
      tone="green"
      title="Delivered"
      count="53 stories"
      items={[{ title: 'Product catalog', detail: 'and field library.' }]}
    />,
  )
  expect(screen.getByText('Delivered')).toBeInTheDocument()
  expect(screen.getByText('53 stories')).toBeInTheDocument()
  expect(screen.getByText('Product catalog')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test**

Run: `npm test -- BucketColumn`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add BucketColumn component"
```

---

### Task 8: MetricsTable

**Files:**
- Create: `src/components/MetricsTable.tsx`
- Test: `src/components/MetricsTable.test.tsx`

**Interfaces:**
- Consumes: `Metric` from `shared/readiness`; `InfoTooltip`.
- Produces: `MetricsTable({ metrics })`.

- [ ] **Step 1: Create `src/components/MetricsTable.tsx`**

```tsx
import type { Metric } from '../../shared/readiness'
import { InfoTooltip } from './InfoTooltip'

const STATUS_CLASS: Record<Metric['status'], string> = {
  at_target: 'ok',
  near: 'near',
  blocked: 'blk',
  no_target: 'none',
}

export function MetricsTable({ metrics }: { metrics: Metric[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Capability</th>
          <th>Weight</th>
          <th>
            Current
            <InfoTooltip flipLeft>
              Where the metric sits today. "Not emitted" means the analyzer does not yet produce this output. "Measured / TBD" means data flows but no target exists to score against.
            </InfoTooltip>
          </th>
          <th>Target</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((m) => (
          <tr key={m.capability}>
            <td>{m.capability}</td>
            <td>{m.weight}%</td>
            <td>{m.current}</td>
            <td>{m.target}</td>
            <td><span className={`st ${STATUS_CLASS[m.status]}`}>{m.statusLabel}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 2: Write the failing test `src/components/MetricsTable.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { MetricsTable } from './MetricsTable'

test('renders rows including sentinel current values', () => {
  render(
    <MetricsTable
      metrics={[
        { capability: 'Reads statements correctly', weight: 30, current: '93.8%', target: '95%', status: 'at_target', statusLabel: 'At target' },
        { capability: 'Output the system trusts', weight: 20, current: 'Not emitted', target: '70%', status: 'blocked', statusLabel: 'Blocked' },
      ]}
    />,
  )
  expect(screen.getByText('Reads statements correctly')).toBeInTheDocument()
  expect(screen.getByText('Not emitted')).toBeInTheDocument()
  expect(screen.getByText('Blocked')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test**

Run: `npm test -- MetricsTable`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add MetricsTable component"
```

---

### Task 9: Masthead + Tabs

**Files:**
- Create: `src/components/Masthead.tsx`, `src/components/Tabs.tsx`
- Test: `src/components/Tabs.test.tsx`, `src/components/Masthead.test.tsx`

**Interfaces:**
- Consumes: `Module` from `shared/readiness`.
- Produces: `Masthead({ asOf })`; `Tabs({ modules, activeKey, onSelect })`.

- [ ] **Step 1: Create `src/components/Masthead.tsx`**

```tsx
export function Masthead({ asOf }: { asOf: string }) {
  const when = new Date(asOf).toLocaleString()
  return (
    <div className="masthead">
      <div className="brand">
        LendLogic
        <span>Delivery Readiness Console</span>
      </div>
      <div className="asof">
        as of
        <b>{when}</b>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/Tabs.tsx`**

```tsx
import type { Module } from '../../shared/readiness'

export function Tabs({ modules, activeKey, onSelect }: {
  modules: Module[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {modules.map((m) => (
        <button
          key={m.key}
          className={`tab${m.key === activeKey ? ' active' : ''}`}
          role="tab"
          aria-selected={m.key === activeKey}
          onClick={() => onSelect(m.key)}
        >
          {m.name}
          <span className="mini">{m.percent}%</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Write the failing test `src/components/Masthead.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { Masthead } from './Masthead'

test('renders the brand', () => {
  render(<Masthead asOf="2026-06-17T14:00:00Z" />)
  expect(screen.getByText('LendLogic')).toBeInTheDocument()
  expect(screen.getByText('Delivery Readiness Console')).toBeInTheDocument()
})
```

- [ ] **Step 4: Write the failing test `src/components/Tabs.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Tabs } from './Tabs'
import type { Module } from '../../shared/readiness'

const modules = [
  { key: 'pe', name: 'Pricing & Eligibility', percent: 71 },
  { key: 'bank', name: 'Bank Statement Analyzer', percent: 77 },
] as unknown as Module[]

test('renders one tab per module and reports clicks', async () => {
  const onSelect = vi.fn()
  render(<Tabs modules={modules} activeKey="pe" onSelect={onSelect} />)
  expect(screen.getAllByRole('tab')).toHaveLength(2)
  await userEvent.click(screen.getByRole('tab', { name: /Bank Statement Analyzer/ }))
  expect(onSelect).toHaveBeenCalledWith('bank')
})
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- Tabs Masthead`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Masthead and Tabs components"
```

---

### Task 10: DeliveryPanel

**Files:**
- Create: `src/components/DeliveryPanel.tsx`
- Test: `src/components/DeliveryPanel.test.tsx`

**Interfaces:**
- Consumes: `DeliveryModule`; `ProgressBar`, `BucketColumn`, `AssumedBadge`.
- Produces: `DeliveryPanel({ module })`.

- [ ] **Step 1: Create `src/components/DeliveryPanel.tsx`**

```tsx
import type { DeliveryModule, Status } from '../../shared/readiness'
import { ProgressBar } from './ProgressBar'
import { BucketColumn } from './BucketColumn'
import { AssumedBadge } from './AssumedBadge'

const PILL: Record<Status, string> = {
  on_track: 'green',
  in_progress: 'blue',
  early: 'grey',
  at_risk: 'amber',
  blocked: 'red',
}

export function DeliveryPanel({ module: m }: { module: DeliveryModule }) {
  return (
    <div className="panel active" role="tabpanel">
      <div className="modband" style={m.accentColor ? { borderLeftColor: m.accentColor } : undefined}>
        <div>
          <div className="mtitle">
            {m.name}
            {m.assumed && m.assumedLabel ? <> <AssumedBadge text={m.assumedLabel} /></> : null}
          </div>
          <div className="msub">{m.sub}</div>
        </div>
        <div className="release">
          Target
          <b className={m.dateConfidence === 'projected' ? 'est' : ''}>{m.targetDate}</b>
        </div>
      </div>
      <div className="row3">
        <div className="card">
          <div className="label">Delivery progress</div>
          <div>
            <span className="bignum">{m.percent}<span className="unit">%</span></span>
            <span className={`pill ${PILL[m.status]}`}>{m.statusLabel}</span>
          </div>
          <ProgressBar percent={m.percent} color={m.accentColor} />
          <div className="note">{m.note}</div>
        </div>
        <div className="card">
          <div className="label">In progress</div>
          <div className="bignum">{m.counts.inProgress}</div>
        </div>
        <div className="card">
          <div className="label">Remaining</div>
          <div className="bignum">{m.counts.remaining}</div>
        </div>
      </div>
      <div className="buckets">
        <BucketColumn tone="green" title="Delivered" count={`${m.counts.delivered} stories`} items={m.buckets.delivered} />
        <BucketColumn tone="amber" title="In Progress" count={`${m.counts.inProgress} stories`} items={m.buckets.inProgress} />
        <BucketColumn tone="grey" title="Remaining" count={`${m.counts.remaining} stories`} items={m.buckets.remaining} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test `src/components/DeliveryPanel.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { DeliveryPanel } from './DeliveryPanel'
import type { DeliveryModule } from '../../shared/readiness'

const m: DeliveryModule = {
  key: 'pe', name: 'Pricing & Eligibility', sub: 'Pricing engine.', phase: 'delivery',
  percent: 71, status: 'on_track', statusLabel: 'On track', note: '53 of 75 accepted.',
  targetDate: '11 July', dateConfidence: 'committed', assumed: false,
  counts: { delivered: 53, inProgress: 14, remaining: 8 },
  buckets: {
    delivered: [{ title: 'Product catalog' }],
    inProgress: [{ title: 'Final price calc' }],
    remaining: [{ title: 'Series 2 rules' }],
  },
}

test('renders module name, percent, and three buckets', () => {
  render(<DeliveryPanel module={m} />)
  expect(screen.getByText('Pricing & Eligibility')).toBeInTheDocument()
  expect(screen.getByText('71')).toBeInTheDocument()
  expect(screen.getByText('Delivered')).toBeInTheDocument()
  expect(screen.getByText('In Progress')).toBeInTheDocument()
  expect(screen.getByText('Remaining')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test**

Run: `npm test -- DeliveryPanel`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add DeliveryPanel component"
```

---

### Task 11: MeasurementPanel

**Files:**
- Create: `src/components/MeasurementPanel.tsx`
- Test: `src/components/MeasurementPanel.test.tsx`

**Interfaces:**
- Consumes: `MeasurementModule`; `ProgressBar`, `BucketColumn`, `MetricsTable`.
- Produces: `MeasurementPanel({ module })`.

- [ ] **Step 1: Create `src/components/MeasurementPanel.tsx`**

```tsx
import type { MeasurementModule } from '../../shared/readiness'
import { ProgressBar } from './ProgressBar'
import { BucketColumn } from './BucketColumn'
import { MetricsTable } from './MetricsTable'

export function MeasurementPanel({ module: m }: { module: MeasurementModule }) {
  return (
    <div className="panel active" role="tabpanel">
      <div className="modband">
        <div>
          <div className="mtitle">{m.name}</div>
          <div className="msub">{m.sub}</div>
        </div>
        <div className="release">
          Target
          <b className="est">{m.targetDate}</b>
        </div>
      </div>
      <div className="row3">
        <div className="card">
          <div className="label">Production readiness</div>
          <div>
            <span className="bignum">{m.percent}<span className="unit">%</span></span>
            <span className="pill amber">{m.statusLabel}</span>
          </div>
          <ProgressBar percent={m.percent} />
          <div className="note">{m.note}</div>
        </div>
        <div className="card">
          <div className="label">Capabilities at standard</div>
          <div className="bignum">{m.capabilitiesAtStandard.count}<span className="unit"> of {m.capabilitiesAtStandard.of}</span></div>
        </div>
      </div>
      <div className="note">{m.gapNote}</div>
      <div className="buckets">
        <BucketColumn tone="green" title="Achieved" items={m.buckets.achieved} />
        <BucketColumn tone="amber" title="Holding" items={m.buckets.holding} />
        <BucketColumn tone="red" title="Must Complete" items={m.buckets.mustComplete} />
      </div>
      <details className="detail" open>
        <summary>By the numbers</summary>
        <MetricsTable metrics={m.metrics} />
      </details>
    </div>
  )
}
```

- [ ] **Step 2: Write the failing test `src/components/MeasurementPanel.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react'
import { MeasurementPanel } from './MeasurementPanel'
import type { MeasurementModule } from '../../shared/readiness'

const bank: MeasurementModule = {
  key: 'bank', name: 'Bank Statement Analyzer', sub: 'Measurement.', phase: 'measurement',
  percent: 77, status: 'on_track', statusLabel: 'On track', note: 'Weighted.',
  targetDate: '~6 July', dateConfidence: 'projected',
  capabilitiesAtStandard: { count: 4, of: 6 },
  composite: { value: 77, denominator: 97, costExcluded: true },
  gapNote: '23 points from 100.',
  metrics: [
    { capability: 'Output the system trusts', weight: 20, current: 'Not emitted', target: '70%', status: 'blocked', statusLabel: 'Blocked' },
  ],
  buckets: { achieved: [], holding: [], mustComplete: [] },
}

test('renders composite, capability count, and the metrics table', () => {
  render(<MeasurementPanel module={bank} />)
  expect(screen.getByText('77')).toBeInTheDocument()
  expect(screen.getByText('4')).toBeInTheDocument()
  expect(screen.getByText('Not emitted')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run the test**

Run: `npm test -- MeasurementPanel`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add MeasurementPanel component"
```

---

### Task 12: App wiring — fetch states + panel routing

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx` (replace the Task 1 smoke test)

**Interfaces:**
- Consumes: `fetchReadiness`; `Masthead`, `Tabs`, `DeliveryPanel`, `MeasurementPanel`; types `ReadinessPayload`, `Module`.
- Produces: the wired `App` (default export).

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Module, ReadinessPayload } from '../shared/readiness'
import { fetchReadiness } from './api'
import { Masthead } from './components/Masthead'
import { Tabs } from './components/Tabs'
import { DeliveryPanel } from './components/DeliveryPanel'
import { MeasurementPanel } from './components/MeasurementPanel'

function renderPanel(m: Module) {
  return m.phase === 'measurement'
    ? <MeasurementPanel module={m} />
    : <DeliveryPanel module={m} />
}

export default function App() {
  const [payload, setPayload] = useState<ReadinessPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadiness(ctrl.signal)
      .then((p) => {
        setPayload(p)
        setActiveKey(p.modules[0]?.key ?? null)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => ctrl.abort()
  }, [])

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
      {renderPanel(active)}
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/App.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'
import { buildPayload } from '../shared/readiness'

vi.mock('./api', () => ({
  fetchReadiness: vi.fn(() => Promise.resolve(buildPayload('2026-06-17T14:00:00Z'))),
}))

afterEach(() => vi.clearAllMocks())

test('renders the first module after load and switches tabs', async () => {
  render(<App />)
  await waitFor(() => expect(screen.getByText('Pricing & Eligibility')).toBeInTheDocument())
  await userEvent.click(screen.getByRole('tab', { name: /Bank Statement Analyzer/ }))
  expect(screen.getByText('Capabilities at standard')).toBeInTheDocument()
})

test('shows an error card when the fetch fails', async () => {
  const { fetchReadiness } = await import('./api')
  vi.mocked(fetchReadiness).mockRejectedValueOnce(new Error('boom'))
  render(<App />)
  await waitFor(() => expect(screen.getByText(/Could not load the console/)).toBeInTheDocument())
})
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 4: Manual smoke check with the dev server**

Run: `npm run dev`, open the served URL. Note: `/api/readiness` is served by Vercel, not Vite, so in plain `vite dev` the fetch will 404. Use `npx vercel dev` instead to serve the function and the SPA together. Expected: all seven tabs render styled; switching tabs animates the bar; the bank tab shows the metrics table with "Not emitted".

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Wire App: fetch states, tab routing, panel rendering"
```

---

### Task 13: Deploy to Vercel (manual verification)

**Files:** none (deploy step).

- [ ] **Step 1: Link and deploy a preview**

Run: `npx vercel link` then `npx vercel` (preview). Confirm the build detects Vite and bundles the `api/` function.

- [ ] **Step 2: Verify the live preview**

Open the preview URL. Expected: dashboard loads, `GET /api/readiness` returns 200 JSON, `X-Robots-Tag: noindex` present on responses, all seven tabs render.

- [ ] **Step 3: Push the branch**

```bash
git push origin feature/scaffold-readiness-console
```

- [ ] **Step 4: Stop before merging**

Do not merge to `develop`/`main`. Open a PR and hand off for review per the project git-flow.

---

## Self-Review

**Spec coverage:** §3 stack → Tasks 1,4. §4 repo structure → all tasks. §5 contract → Task 3. §6 data flow → Tasks 5,12. §7 components → Tasks 6–11. §8 error/special states → Tasks 12 (loading/error), 8/11 (sentinels), 10/3 (assumed). §9 testing → every task. §10 deploy/noindex → Tasks 4,13. §11 git → Global Constraints + Task 13.

**Placeholder scan:** No "TBD/TODO" placeholders. The inline `// populate from PoC line N` markers in Task 3 are explicit verbatim-extraction instructions against the committed PoC file, paired with a conformance test — not vague placeholders. The `// fix inProgress/remaining from PoC .bcount` marker is a concrete read instruction.

**Type consistency:** `buildPayload`, `MODULES`, `fetchReadiness`, `ReadinessPayload`, `Module`, `DeliveryModule`, `MeasurementModule`, `BucketItem`, `Metric` are defined in Task 3/5 and consumed with identical names/signatures in Tasks 4,6–12. Component prop shapes match the types. `Status` pill map and `Metric['status']` class map cover all enum members.
