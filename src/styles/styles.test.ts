import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { test, expect } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

test('app.css contains the core PoC classes', () => {
  const css = readFileSync(join(__dirname, './app.css'), 'utf8')
  for (const cls of ['.masthead', '.tabs', '.panel', '.modband', '.bucket', '.bignum', '.fill']) {
    expect(css).toContain(cls)
  }
})
