import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchBoardStories } from './_lib/monday.js'
import { assembleLivePayload } from './_lib/rollup.js'
import { writeLatest } from './_lib/blob.js'
import {
  getAnalyzerBoardId,
  getAnalyzerColumnId,
  getBoardId,
  getCronSecret,
  getModuleColumnId,
  getMondayToken,
} from './_lib/config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${getCronSecret()}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const token = getMondayToken()
    const [storyStories, analyzerStories] = await Promise.all([
      fetchBoardStories({ token, boardId: getBoardId(), moduleColumnId: getModuleColumnId() }),
      fetchBoardStories({ token, boardId: getAnalyzerBoardId(), statusColumnId: 'status', moduleColumnId: getAnalyzerColumnId() }),
    ])
    const payload = assembleLivePayload(storyStories, analyzerStories, new Date().toISOString())
    await writeLatest(payload)
    return res.status(200).json({ ok: true, modules: payload.modules.length, builtAt: payload.builtAt })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
