import { runRefresh } from '../api/_lib/refresh-core.js'

// Entrypoint for the scheduled Container Apps Job. Exit code drives the job's
// success/failure signal, so a total Monday failure exits non-zero.
runRefresh()
  .then((r) => {
    console.log(`refresh ok: ${r.modules} modules at ${r.builtAt}`)
    process.exit(0)
  })
  .catch((e: unknown) => {
    console.error(`refresh failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  })
