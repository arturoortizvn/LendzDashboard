import { afterEach, expect, test, vi } from 'vitest'
import { fetchReadiness } from './api'

afterEach(() => vi.unstubAllGlobals())

test('attaches the bearer token and returns the parsed payload', async () => {
  const payload = { asOf: 'x', modules: [] }
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) })
  vi.stubGlobal('fetch', fetchSpy)
  await expect(fetchReadiness(async () => 'tok')).resolves.toEqual(payload)
  expect(fetchSpy).toHaveBeenCalledWith(
    '/api/readiness',
    expect.objectContaining({ headers: { Authorization: 'Bearer tok' } }),
  )
})

test('throws on a non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
  await expect(fetchReadiness(async () => 'tok')).rejects.toThrow(/500/)
})

test('omits the Authorization header when no token is available', async () => {
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ asOf: 'x', modules: [] }) })
  vi.stubGlobal('fetch', fetchSpy)
  await fetchReadiness(async () => null)
  expect(fetchSpy).toHaveBeenCalledWith(
    '/api/readiness',
    expect.not.objectContaining({ headers: expect.objectContaining({ Authorization: expect.anything() }) }),
  )
})
