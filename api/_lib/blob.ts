import { BlobServiceClient, type BlockBlobClient } from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'
import type { ReadinessPayload } from '../../shared/readiness.js'

const BLOB_NAME = 'latest.json'

// Resolved per call so tests (and config changes) see the current env, and so an
// unconfigured account degrades to "no blob" instead of constructing a bad client.
function latestBlob(): BlockBlobClient | null {
  const account = process.env.AZURE_STORAGE_ACCOUNT
  if (!account) return null
  const container = process.env.AZURE_BLOB_CONTAINER || 'readiness'
  const service = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  )
  return service.getContainerClient(container).getBlockBlobClient(BLOB_NAME)
}

export async function writeLatest(payload: ReadinessPayload): Promise<void> {
  const blob = latestBlob()
  if (!blob) throw new Error('AZURE_STORAGE_ACCOUNT is not set')
  const body = JSON.stringify(payload)
  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  })
}

export async function readLatest(): Promise<ReadinessPayload | null> {
  try {
    const blob = latestBlob()
    if (!blob) return null
    const buf = await blob.downloadToBuffer()
    return JSON.parse(buf.toString('utf8')) as ReadinessPayload
  } catch {
    return null
  }
}
