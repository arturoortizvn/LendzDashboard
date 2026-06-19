import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'

const apiDir = dirname(fileURLToPath(import.meta.url))

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return tsFiles(full)
    if (full.endsWith('.ts') && !full.endsWith('.test.ts')) return [full]
    return []
  })
}

test('every relative import under api/ carries an explicit .js extension', () => {
  for (const file of tsFiles(apiDir)) {
    const src = readFileSync(file, 'utf8')
    const relativeImports = src.match(/from ['"](\.\.?\/[^'"]+)['"]/g) ?? []
    for (const imp of relativeImports) {
      expect(imp, `${file}: ${imp}`).toMatch(/\.js['"]$/)
    }
  }
})
