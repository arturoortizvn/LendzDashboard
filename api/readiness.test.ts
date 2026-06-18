import { afterEach, expect, test, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

vi.mock('./_lib/blob.js', () => ({ readLatest: vi.fn() }))

import handler from './readiness'
import { buildPayload } from '../shared/readiness'
import { readLatest } from './_lib/blob.js'

function mockRes() {
  const res: Partial<VercelResponse> & { body?: unknown; statusCode?: number; headers: Record<string, string> } = {
    headers: {},
    setHeader(k: string, v: string) { this.headers[k] = v; return this as VercelResponse },
    status(code: number) { this.statusCode = code; return this as VercelResponse },
    json(payload: unknown) { this.body = payload; return this as VercelResponse },
  }
  return res
}

afterEach(() => vi.clearAllMocks())

test('serves the last-known-good payload from the blob with cache header', async () => {
  vi.mocked(readLatest).mockResolvedValue(buildPayload('2026-06-18T00:00:00Z'))
  const res = mockRes()
  await handler({} as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[] }
  expect(body.modules).toHaveLength(7)
  expect(res.headers['Cache-Control']).toContain('s-maxage')
})

test('falls back to the config baseline when the blob is missing', async () => {
  vi.mocked(readLatest).mockResolvedValue(null)
  const res = mockRes()
  await handler({} as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source?: string }
  expect(body.modules).toHaveLength(7)
  expect(body.source).toBe('baseline')
})
