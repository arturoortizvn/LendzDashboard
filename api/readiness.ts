import type { Request, Response } from 'express'
import { buildPayload } from '../shared/readiness.js'
import { readLatest } from './_lib/blob.js'
import { boardBackedKeys } from './_lib/config.js'

export default async function handler(_req: Request, res: Response) {
  res.setHeader('Cache-Control', 'public, no-store')
  const latest = await readLatest()
  if (latest) {
    res.status(200).json(latest)
    return
  }
  // No blob yet: serve the baseline, but keep boardless modules hidden like a live build would.
  const baseline = buildPayload(new Date().toISOString())
  const visible = new Set<string>(boardBackedKeys())
  res.status(200).json({ ...baseline, modules: baseline.modules.filter((m) => visible.has(m.key)) })
}
