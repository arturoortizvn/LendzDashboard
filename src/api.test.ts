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
