import { MODULES, buildPayload } from './readiness'

test('exposes seven modules in PoC tab order', () => {
  expect(MODULES.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'tax'])
})

test('flags exactly the assumed modules', () => {
  const assumed = MODULES.filter((m) => m.assumed).map((m) => m.key)
  expect(assumed.sort()).toEqual(['bank', 'id', 'tax', 'vt'])
})

test('bank is a delivery module', () => {
  const bank = MODULES.find((m) => m.key === 'bank')!
  expect(bank.phase).toBe('delivery')
})

test('buildPayload stamps asOf and returns the modules', () => {
  const p = buildPayload('2026-06-17T14:00:00Z')
  expect(p.asOf).toBe('2026-06-17T14:00:00Z')
  expect(p.modules).toBe(MODULES)
})
