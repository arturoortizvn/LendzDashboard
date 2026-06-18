import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildPayload } from '../shared/readiness.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
  res.status(200).json(buildPayload(new Date().toISOString()))
}
