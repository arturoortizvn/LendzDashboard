import { MODULES, ANALYZER_KEYS, buildPayload } from './readiness'

test('exposes ten modules in tab order', () => {
  expect(MODULES.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'broker', 'bank', 'id', 'pl', 'paystub', 'tax'])
})

test('flags exactly the assumed modules', () => {
  const assumed = MODULES.filter((m) => m.assumed).map((m) => m.key)
  expect(assumed.sort()).toEqual(['bank', 'broker', 'id', 'paystub', 'pl', 'tax', 'vt'])
})

test('ANALYZER_KEYS lists the five analyzers in order', () => {
  expect(ANALYZER_KEYS).toEqual(['bank', 'id', 'pl', 'paystub', 'tax'])
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
