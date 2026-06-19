import { afterEach, expect, test, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

vi.mock('./_lib/blob.js', () => ({ readLatest: vi.fn() }))
vi.mock('./_lib/auth.js', () => ({ verifyRequest: vi.fn() }))

import handler from './readiness'
import { buildPayload } from '../shared/readiness'
import { readLatest } from './_lib/blob.js'
import { verifyRequest } from './_lib/auth.js'

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

test('rejects an unauthenticated request with 401 and never reads the blob', async () => {
  vi.mocked(verifyRequest).mockResolvedValue(null)
  const res = mockRes()
  await handler({ headers: {} } as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(401)
  expect(res.body).toEqual({ error: 'unauthorized' })
  expect(readLatest).not.toHaveBeenCalled()
})

test('serves the last-known-good payload to an authenticated request, no shared cache', async () => {
  vi.mocked(verifyRequest).mockResolvedValue({ sub: 'user_1' } as never)
  const live = { ...buildPayload('2026-06-18T00:00:00Z'), source: 'live' as const, builtAt: '2026-06-18T00:00:00Z' }
  vi.mocked(readLatest).mockResolvedValue(live)
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer t' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source: string; builtAt: string }
  expect(body.source).toBe('live')
  expect(body.modules).toHaveLength(7)
  expect(body.builtAt).toBe('2026-06-18T00:00:00Z')
  expect(readLatest).toHaveBeenCalledTimes(1)
  expect(res.headers['Cache-Control']).toContain('no-store')
  expect(res.headers['Cache-Control']).not.toContain('s-maxage')
})

test('falls back to the config baseline when the blob is missing', async () => {
  vi.mocked(verifyRequest).mockResolvedValue({ sub: 'user_1' } as never)
  vi.mocked(readLatest).mockResolvedValue(null)
  const res = mockRes()
  await handler({ headers: { authorization: 'Bearer t' } } as unknown as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { modules: unknown[]; source?: string }
  expect(body.modules).toHaveLength(7)
  expect(body.source).toBe('baseline')
})
