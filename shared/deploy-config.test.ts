import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { expect, test } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('Dockerfile launches the compiled web server entrypoint', () => {
  const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8')
  expect(dockerfile).toMatch(/dist-server\/server\/index\.js/)
})

test('.dockerignore keeps node_modules and test files out of the image', () => {
  const ignore = readFileSync(join(root, '.dockerignore'), 'utf8')
  expect(ignore).toContain('node_modules')
  expect(ignore).toMatch(/\*\.test\.ts/)
})

test('the refresh job cron schedule is declared in the provisioning script', () => {
  const provision = readFileSync(join(root, 'infra/provision.sh'), 'utf8')
  expect(provision).toContain('*/15 * * * *')
})

test('a CI workflow exists to deploy to Azure Container Apps', () => {
  expect(existsSync(join(root, '.github/workflows/deploy.yml'))).toBe(true)
})
