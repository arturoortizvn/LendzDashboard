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

