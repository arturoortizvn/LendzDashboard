import { MODULES, buildPayload } from './readiness'

test('exposes seven modules in PoC tab order', () => {
  expect(MODULES.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'tax'])
})

test('flags exactly the assumed modules', () => {
  const assumed = MODULES.filter((m) => m.phase === 'delivery' && m.assumed).map((m) => m.key)
  expect(assumed.sort()).toEqual(['id', 'tax', 'vt'])
})

test('bank is the only measurement module and carries the 77 composite', () => {
  const bank = MODULES.find((m) => m.key === 'bank')!
  expect(bank.phase).toBe('measurement')
  if (bank.phase === 'measurement') {
    expect(bank.composite).toEqual({ value: 77, denominator: 97, costExcluded: true })
    expect(bank.metrics).toHaveLength(6)
  }
})

test('buildPayload stamps asOf and returns the modules', () => {
  const p = buildPayload('2026-06-17T14:00:00Z')
  expect(p.asOf).toBe('2026-06-17T14:00:00Z')
  expect(p.modules).toBe(MODULES)
})
