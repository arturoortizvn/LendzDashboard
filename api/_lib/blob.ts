import { head, put } from '@vercel/blob'
import type { ReadinessPayload } from '../../shared/readiness.js'

const BLOB_PATH = 'readiness/latest.json'

export async function writeLatest(payload: ReadinessPayload): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(payload), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function readLatest(fetchImpl: typeof fetch = fetch): Promise<ReadinessPayload | null> {
  try {
    const meta = await head(BLOB_PATH)
    const res = await fetchImpl(meta.url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as ReadinessPayload
  } catch {
    return null
  }
}
