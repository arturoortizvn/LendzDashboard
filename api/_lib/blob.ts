import { get, put } from '@vercel/blob'
import type { ReadinessPayload } from '../../shared/readiness.js'

const BLOB_PATH = 'readiness/latest.json'

export async function writeLatest(payload: ReadinessPayload): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(payload), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function readLatest(): Promise<ReadinessPayload | null> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return null
    const result = await get(BLOB_PATH, { access: 'private', useCache: false })
    if (!result?.stream) return null
    return (await new Response(result.stream).json()) as ReadinessPayload
  } catch {
    return null
  }
}
