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

