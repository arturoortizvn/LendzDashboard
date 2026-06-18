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

