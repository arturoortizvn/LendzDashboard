import { afterEach, expect, test, vi } from 'vitest'
import { get, put } from '@vercel/blob'
import { readLatest, writeLatest } from './blob'

vi.mock('@vercel/blob', () => ({ put: vi.fn(), get: vi.fn() }))

const streamOf = (value: unknown) => new Response(JSON.stringify(value)).body

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
  const p = await readLatest()
  expect(p).toBeNull()
  expect(get).not.toHaveBeenCalled()
})

test('readLatest reads the private blob by pathname and parses it', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'blob_tok'
  vi.mocked(get).mockResolvedValue({ stream: streamOf({ asOf: 'y', modules: [] }) } as never)
  const p = await readLatest()
  expect(p).toEqual({ asOf: 'y', modules: [] })
  expect(get).toHaveBeenCalledWith('readiness/latest.json', expect.objectContaining({ access: 'private' }))
})

test('readLatest returns null when the blob is missing', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'blob_tok'
  vi.mocked(get).mockResolvedValue(null)
  const p = await readLatest()
  expect(p).toBeNull()
})

test('readLatest returns null when get throws', async () => {
  process.env.BLOB_READ_WRITE_TOKEN = 'blob_tok'
  vi.mocked(get).mockRejectedValue(new Error('BlobServiceNotAvailable'))
  const p = await readLatest()
  expect(p).toBeNull()
})
