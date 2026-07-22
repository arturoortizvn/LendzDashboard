import { afterEach, beforeEach, expect, test, vi } from 'vitest'

const upload = vi.fn()
const downloadToBuffer = vi.fn()
const getBlockBlobClient = vi.fn(() => ({ upload, downloadToBuffer }))
const getContainerClient = vi.fn(() => ({ getBlockBlobClient }))

vi.mock('@azure/storage-blob', () => ({
  BlobServiceClient: vi.fn(() => ({ getContainerClient })),
}))
vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(() => ({})),
}))

import { BlobServiceClient } from '@azure/storage-blob'
import { readLatest, writeLatest } from './blob'

beforeEach(() => {
  process.env.AZURE_STORAGE_ACCOUNT = 'lendzstore'
  delete process.env.AZURE_BLOB_CONTAINER
})
afterEach(() => {
  vi.clearAllMocks()
  delete process.env.AZURE_STORAGE_ACCOUNT
  delete process.env.AZURE_BLOB_CONTAINER
})

test('writeLatest uploads the payload as JSON to the fixed blob via managed identity', async () => {
  const payload = { asOf: 'x', builtAt: 'x', modules: [], source: 'live' as const }
  await writeLatest(payload as never)
  expect(BlobServiceClient).toHaveBeenCalledWith(
    'https://lendzstore.blob.core.windows.net',
    expect.anything(),
  )
  expect(getContainerClient).toHaveBeenCalledWith('readiness')
  expect(getBlockBlobClient).toHaveBeenCalledWith('latest.json')
  const body = JSON.stringify(payload)
  expect(upload).toHaveBeenCalledWith(
    body,
    Buffer.byteLength(body),
    expect.objectContaining({ blobHTTPHeaders: { blobContentType: 'application/json' } }),
  )
})

test('writeLatest honors a custom container name', async () => {
  process.env.AZURE_BLOB_CONTAINER = 'data'
  await writeLatest({ asOf: 'x', builtAt: 'x', modules: [], source: 'live' } as never)
  expect(getContainerClient).toHaveBeenCalledWith('data')
})

test('writeLatest throws when AZURE_STORAGE_ACCOUNT is not set', async () => {
  delete process.env.AZURE_STORAGE_ACCOUNT
  await expect(writeLatest({ asOf: 'x', builtAt: 'x', modules: [], source: 'live' } as never)).rejects.toThrow()
})

test('readLatest returns null when AZURE_STORAGE_ACCOUNT is not set', async () => {
  delete process.env.AZURE_STORAGE_ACCOUNT
  const p = await readLatest()
  expect(p).toBeNull()
  expect(BlobServiceClient).not.toHaveBeenCalled()
})

test('readLatest downloads the blob and parses it', async () => {
  downloadToBuffer.mockResolvedValue(Buffer.from(JSON.stringify({ asOf: 'y', modules: [] })))
  const p = await readLatest()
  expect(p).toEqual({ asOf: 'y', modules: [] })
  expect(getBlockBlobClient).toHaveBeenCalledWith('latest.json')
})

test('readLatest returns null when the download throws (missing blob or outage)', async () => {
  downloadToBuffer.mockRejectedValue(new Error('BlobNotFound'))
  const p = await readLatest()
  expect(p).toBeNull()
})
