import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchBoardStories } from './_lib/monday.js'
import { assembleLivePayload } from './_lib/rollup.js'
import { writeLatest } from './_lib/blob.js'
import { getBoardId, getCronSecret, getModuleColumnId, getMondayToken } from './_lib/config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${getCronSecret()}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const stories = await fetchBoardStories({
      token: getMondayToken(),
      boardId: getBoardId(),
      moduleColumnId: getModuleColumnId(),
    })
    const payload = assembleLivePayload(stories, new Date().toISOString())
    await writeLatest(payload)
    return res.status(200).json({ ok: true, modules: payload.modules.length, builtAt: payload.builtAt })
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
