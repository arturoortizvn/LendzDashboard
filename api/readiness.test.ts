import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import handler from './readiness'

const __dirname = dirname(fileURLToPath(import.meta.url))

function mockRes() {
  const res: Partial<VercelResponse> & { body?: unknown; statusCode?: number; headers: Record<string, string> } = {
    headers: {},
    setHeader(k: string, v: string) { this.headers[k] = v; return this as VercelResponse },
    status(code: number) { this.statusCode = code; return this as VercelResponse },
    json(payload: unknown) { this.body = payload; return this as VercelResponse },
  }
  return res
}

test('returns a 200 payload with asOf and seven modules', () => {
  const res = mockRes()
  handler({} as VercelRequest, res as VercelResponse)
  expect(res.statusCode).toBe(200)
  const body = res.body as { asOf: string; modules: unknown[] }
  expect(typeof body.asOf).toBe('string')
  expect(body.modules).toHaveLength(7)
  expect(res.headers['Cache-Control']).toContain('s-maxage')
})

test('relative imports use explicit .js extensions for Node ESM runtime', () => {
  const src = readFileSync(join(__dirname, './readiness.ts'), 'utf8')
  const relativeImports = src.match(/from '(\.\.?\/[^']+)'/g) ?? []
  for (const imp of relativeImports) {
    expect(imp).toMatch(/\.js'$/)
  }
})
