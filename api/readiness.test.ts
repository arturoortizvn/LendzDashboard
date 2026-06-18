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
