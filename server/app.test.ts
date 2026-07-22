// @vitest-environment node
import { afterAll, beforeAll, expect, test } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Server } from 'node:http'
import { createApp } from './app'

let server: Server
let base: string

beforeAll(async () => {
  // No storage account configured → readLatest returns null → baseline path.
  delete process.env.AZURE_STORAGE_ACCOUNT
  const staticDir = mkdtempSync(join(tmpdir(), 'lendz-static-'))
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>lendz-spa</title>')
  await new Promise<void>((resolve) => {
    server = createApp(staticDir).listen(0, () => resolve())
  })
  const addr = server.address()
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

test('GET /api/readiness serves the baseline payload with noindex + no-store', async () => {
  const res = await fetch(`${base}/api/readiness`)
  expect(res.status).toBe(200)
  expect(res.headers.get('x-robots-tag')).toBe('noindex')
  expect(res.headers.get('cache-control')).toContain('no-store')
  const body = (await res.json()) as { source: string; modules: unknown[] }
  expect(body.source).toBe('baseline')
  expect(Array.isArray(body.modules)).toBe(true)
})

test('unknown non-API route falls back to index.html (SPA)', async () => {
  const res = await fetch(`${base}/some/deep/client/route`)
  expect(res.status).toBe(200)
  expect(await res.text()).toContain('lendz-spa')
})

test('unknown /api route returns a JSON 404, not the SPA shell', async () => {
  const res = await fetch(`${base}/api/does-not-exist`)
  expect(res.status).toBe(404)
  expect(res.headers.get('x-robots-tag')).toBe('noindex')
})
