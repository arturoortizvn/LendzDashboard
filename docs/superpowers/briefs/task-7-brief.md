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

