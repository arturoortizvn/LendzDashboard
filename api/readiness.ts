import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPayload } from '../shared/readiness.js'
import { readLatest } from './_lib/blob.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
  const latest = await readLatest()
  res.status(200).json(latest ?? buildPayload(new Date().toISOString()))
}
