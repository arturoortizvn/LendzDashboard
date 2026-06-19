import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { VercelRequest } from '@vercel/node'

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }))

import { getAuthorizedParties, verifyRequest } from './auth'
import { verifyToken } from '@clerk/backend'

const ORIGIN_ENV = ['CLERK_AUTHORIZED_PARTIES', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL', 'VERCEL_BRANCH_URL']

beforeEach(() => {
  process.env.CLERK_SECRET_KEY = 'sk_test'
  for (const k of ORIGIN_ENV) delete process.env[k]
})
afterEach(() => {
  vi.clearAllMocks()
  for (const k of ORIGIN_ENV) delete process.env[k]
})

function req(authorization?: string): VercelRequest {
  return { headers: authorization ? { authorization } : {} } as unknown as VercelRequest
}

test('returns the verified claims for a valid bearer token', async () => {
  vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
  const claims = await verifyRequest(req('Bearer good'))
  expect(claims).toEqual({ sub: 'user_1' })
  expect(verifyToken).toHaveBeenCalledWith('good', { secretKey: 'sk_test' })
})

test('does not enforce authorizedParties when CLERK_AUTHORIZED_PARTIES is unset', () => {
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'lendz-dashboard.vercel.app'
  expect(getAuthorizedParties()).toEqual([])
})

test('builds the allowlist from the configured parties plus the deployment origins', () => {
  process.env.CLERK_AUTHORIZED_PARTIES = 'https://lendz-dashboard.vercel.app, https://readiness.viewnear.com'
  process.env.VERCEL_PROJECT_PRODUCTION_URL = 'lendz-dashboard.vercel.app'
  process.env.VERCEL_URL = 'lendz-dashboard-abc123.vercel.app'
  expect(getAuthorizedParties()).toEqual([
    'https://lendz-dashboard.vercel.app',
    'https://readiness.viewnear.com',
    'https://lendz-dashboard-abc123.vercel.app',
  ])
})

test('passes authorizedParties to verifyToken when configured', async () => {
  process.env.CLERK_AUTHORIZED_PARTIES = 'https://lendz-dashboard.vercel.app'
  vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_1' } as never)
  await verifyRequest(req('Bearer good'))
  expect(verifyToken).toHaveBeenCalledWith('good', {
    secretKey: 'sk_test',
    authorizedParties: ['https://lendz-dashboard.vercel.app'],
  })
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
