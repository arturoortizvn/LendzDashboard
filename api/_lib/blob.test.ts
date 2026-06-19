import { afterEach, expect, test, vi } from 'vitest'
import { head, put } from '@vercel/blob'
import { readLatest, writeLatest } from './blob'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), head: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
  delete process.env.BLOB_READ_WRITE_TOKEN
})

test('writeLatest stores a private object at the fixed path with overwrite enabled', async () => {
  const payload = { asOf: 'x', modules: [], source: 'live' as const }
  await writeLatest(payload)
  expect(put).toHaveBeenCalledWith(
    'readiness/latest.json',
    JSON.stringify(payload),
    expect.objectContaining({ access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }),
  )
})

test('readLatest returns null when BLOB_READ_WRITE_TOKEN is not set', async () => {
  const fetchImpl = vi.fn()
  const p = await readLatest(fetchImpl as unknown as typeof fetch)
  expect(p).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled()
})

test('readLatest fetches the blob with the read-write token and parses it', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'blob_tok'
  vi.mocked(head).mockResolvedValue({ url: 'https://blob/readiness/latest.json' } as never)
  const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ asOf: 'y', modules: [] }) })
  const p = await readLatest(fetchImpl as unknown as typeof fetch)
  expect(p).toEqual({ asOf: 'y', modules: [] })
  expect(fetchImpl).toHaveBeenCalledWith(
    'https://blob/readiness/latest.json',
    expect.objectContaining({ headers: { Authorization: 'Bearer blob_tok' } }),
  )
})

test('readLatest returns null when the blob is missing', async () => {
  vi.mocked(head).mockRejectedValue(new Error('BlobNotFound'))
  const p = await readLatest()
  expect(p).toBeNull()
})

test('readLatest returns null when fetch returns a non-ok response', async () => {
  vi.mocked(head).mockResolvedValue({ url: 'https://blob/readiness/latest.json' } as never)
  const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(null) })
  const p = await readLatest(fetchImpl as unknown as typeof fetch)
  expect(p).toBeNull()
})
