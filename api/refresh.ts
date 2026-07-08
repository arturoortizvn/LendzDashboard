import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchBoardStories } from './_lib/monday.js'
import type { RawStory } from './_lib/monday.js'
import { assembleLivePayload } from './_lib/rollup.js'
import { writeLatest } from './_lib/blob.js'
import {
  boardBackedKeys,
  getCronSecret,
  getModuleBoardId,
  getModuleStatusColumnId,
  getMondayToken,
  type ModuleKey,
} from './_lib/config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${getCronSecret()}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  try {
    const token = getMondayToken()
    const keys = boardBackedKeys()
    const results = await Promise.all(
      keys.map((k) =>
        fetchBoardStories({ token, boardId: getModuleBoardId(k)!, statusColumnId: getModuleStatusColumnId(k) })
          .then((stories) => ({ k, stories: stories as RawStory[] | null }))
          .catch(() => ({ k, stories: null as RawStory[] | null })),
      ),
    )
    // A single decommissioned/renamed board must not sink the whole refresh, but
    // a total failure (bad token / Monday down) must not clobber the last-good blob.
    if (results.every((r) => r.stories === null)) {
      return res.status(500).json({ error: 'all Monday board fetches failed' })
    }
    const storiesByModule: Partial<Record<ModuleKey, RawStory[]>> = {}
    for (const r of results) {
      if (r.stories !== null) storiesByModule[r.k] = r.stories
    }
    const payload = assembleLivePayload(storiesByModule, new Date().toISOString())
    await writeLatest(payload)
    return res.status(200).json({ ok: true, modules: payload.modules.length, builtAt: payload.builtAt })
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
  }
}
