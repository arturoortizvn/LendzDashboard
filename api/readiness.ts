import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPayload } from '../shared/readiness.js'
import { readLatest } from './_lib/blob.js'
import { verifyRequest } from './_lib/auth.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const claims = await verifyRequest(req)
  if (!claims) return res.status(401).json({ error: 'unauthorized' })
  res.setHeader('Cache-Control', 'private, no-store')
  const latest = await readLatest()
  res.status(200).json(latest ?? buildPayload(new Date().toISOString()))
}
