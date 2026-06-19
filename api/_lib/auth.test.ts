import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { VercelRequest } from '@vercel/node'

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }))

import { verifyRequest } from './auth'
import { verifyToken } from '@clerk/backend'

beforeEach(() => {
  process.env.CLERK_SECRET_KEY = 'sk_test'
})
afterEach(() => vi.clearAllMocks())

function req(authorization?: string): VercelRequest {
  return { headers: authorization ? { authorization } : {} } as unknown as VercelRequest
}

test('returns the verified claims for a valid bearer token', async () => {
  vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
  const claims = await verifyRequest(req('Bearer good'))
  expect(claims).toEqual({ sub: 'user_1' })
  expect(verifyToken).toHaveBeenCalledWith('good', { secretKey: 'sk_test' })
})

test('returns null when there is no Authorization header', async () => {
  const claims = await verifyRequest(req())
  expect(claims).toBeNull()
  expect(verifyToken).not.toHaveBeenCalled()
})

test('returns null for a non-bearer Authorization header', async () => {
  const claims = await verifyRequest(req('Basic abc'))
  expect(claims).toBeNull()
  expect(verifyToken).not.toHaveBeenCalled()
})

test('returns null when verifyToken rejects (invalid/expired)', async () => {
  vi.mocked(verifyToken).mockRejectedValue(new Error('token-invalid'))
  const claims = await verifyRequest(req('Bearer bad'))
  expect(claims).toBeNull()
})
