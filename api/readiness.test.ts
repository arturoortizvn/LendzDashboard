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

test('serves the last-known-good payload publicly, no shared cache', async () => {
  const live = { ...buildPayload('2026-06-18T00:00:00Z'), source: 'live' as const, builtAt: '2026-06-18T00:00:00Z' }
  vi.mocked(readLatest).mockResolvedValue(live)
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source: string; builtAt: string }
  expect(body.source).toBe('live')
  expect(body.modules).toHaveLength(9)
  expect(body.builtAt).toBe('2026-06-18T00:00:00Z')
  expect(readLatest).toHaveBeenCalledTimes(1)
  expect(res.headers['Cache-Control']).toContain('public')
  expect(res.headers['Cache-Control']).toContain('no-store')
})

test('falls back to the config baseline when the blob is missing', async () => {
  vi.mocked(readLatest).mockResolvedValue(null)
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source?: string }
  expect(body.modules).toHaveLength(9)
  expect(body.source).toBe('baseline')
  expect(res.headers['Cache-Control']).toContain('public')
  expect(res.headers['Cache-Control']).toContain('no-store')
})
