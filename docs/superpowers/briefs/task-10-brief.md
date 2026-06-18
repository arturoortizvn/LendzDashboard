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

