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

