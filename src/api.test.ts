import { afterEach, expect, test, vi } from 'vitest'
import { fetchReadiness } from './api'

afterEach(() => vi.unstubAllGlobals())

test('fetches and returns the parsed payload without an Authorization header', async () => {
  const payload = { asOf: 'x', modules: [] }
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) })
  vi.stubGlobal('fetch', fetchSpy)
  await expect(fetchReadiness()).resolves.toEqual(payload)
  expect(fetchSpy).toHaveBeenCalledWith(
    '/api/readiness',
    expect.not.objectContaining({ headers: expect.objectContaining({ Authorization: expect.anything() }) }),
  )
})

test('throws on a non-ok response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
  await expect(fetchReadiness()).rejects.toThrow(/500/)
})
