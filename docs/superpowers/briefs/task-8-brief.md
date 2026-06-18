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

