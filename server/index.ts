import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createApp } from './app.js'

// Compiled to dist-server/server/index.js; the vite build sits at <root>/dist.
const staticDir = join(dirname(fileURLToPath(import.meta.url)), '../../dist')
const port = Number(process.env.PORT) || 3000

createApp(staticDir).listen(port, () => {
  console.log(`LendzDashboard listening on :${port} (static: ${staticDir})`)
})
