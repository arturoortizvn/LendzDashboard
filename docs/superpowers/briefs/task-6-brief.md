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

