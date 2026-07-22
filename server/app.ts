import express, { type Express } from 'express'
import { join } from 'node:path'
import readiness from '../api/readiness.js'

// Wires the SPA + API onto one Express app. staticDir is injected so production
// and tests can point it at different locations.
export function createApp(staticDir: string): Express {
  const app = express()

  // Replaces the global `X-Robots-Tag: noindex` that vercel.json used to set.
  app.use((_req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex')
    next()
  })

  app.get('/api/readiness', readiness)

  app.use(express.static(staticDir))

  // SPA fallback for client routes; unknown API paths get a JSON 404, not index.html.
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      res.status(404).json({ error: 'not found' })
      return
    }
    res.sendFile(join(staticDir, 'index.html'))
  })

  return app
}
