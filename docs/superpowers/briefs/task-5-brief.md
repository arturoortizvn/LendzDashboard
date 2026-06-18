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

