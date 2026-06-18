import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('vercel.json registers the /api/refresh cron', () => {
  const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'))
  const paths = (cfg.crons ?? []).map((c: { path: string }) => c.path)
  expect(paths).toContain('/api/refresh')
})

test('.vercelignore keeps test files out of the deploy', () => {
  const ignore = readFileSync(join(root, '.vercelignore'), 'utf8')
  expect(ignore).toContain('*.test.ts')
})
