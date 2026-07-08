import { expect, test } from 'vitest'
import { assembleLivePayload, buildDeliveryModule } from './rollup'
import { MODULES_BY_KEY } from '../../shared/readiness'
import type { RawStory } from './monday'

test('rolls up counts, percent, status, note, and cleaned titles', () => {
  const stories: RawStory[] = [
    { name: 'F-01-06 · Eligibility evaluation', status: 'Done', module: null },
    { name: 'CLTV calculation issue', status: 'In Progress', module: null },
    { name: 'Series 2 rules', status: 'Ready to start', module: null },
  ]
  const m = buildDeliveryModule('pe', stories)
  expect(m.assumed).toBe(false)
  expect(m.counts).toEqual({ delivered: 1, inProgress: 1, remaining: 1 })
  expect(m.percent).toBe(33)
  expect(m.status).toBe('early')
  expect(m.statusLabel).toBe('Early build')
  expect(m.note).toBe('1 of 3 stories accepted.')
  expect(m.buckets.delivered[0].title).toBe('Eligibility evaluation')
  expect(m.buckets.inProgress[0].title).toBe('CLTV calculation issue')
  expect(m.buckets.remaining[0].title).toBe('Series 2 rules')
})

test('a module with no stories falls back to the assumed baseline', () => {
  const base = MODULES_BY_KEY['tax']
  const m = buildDeliveryModule('tax', [])
  expect(m.assumed).toBe(true)
  expect(m.percent).toBe(base.percent)
  expect(m.buckets).toBe((base as typeof m).buckets)
})

test('zero-stories assumed: module without base assumedLabel gets fallback label, module with base label preserves it', () => {
  const pe = buildDeliveryModule('pe', [])
  expect(pe.assumed).toBe(true)
  expect(pe.assumedLabel).toBe('Awaiting board data')

  const tax = buildDeliveryModule('tax', [])
  expect(tax.assumed).toBe(true)
  expect(tax.assumedLabel).toBe('Scaffolding done')
})

test('assembleLivePayload emits only board-backed modules in order, source live', () => {
  const p = assembleLivePayload({}, '2026-07-08T00:00:00Z')
  expect(p.modules.map((m) => m.key)).toEqual(['pe', 'uw', 'broker', 'bank', 'id', 'pl', 'paystub'])
  expect(p.source).toBe('live')
  expect(p.builtAt).toBe('2026-07-08T00:00:00Z')
  expect(p.asOf).toBe('2026-07-08T00:00:00Z')
})

test('a module with stories goes live; a board-backed module with none is assumed', () => {
  const p = assembleLivePayload({ pe: [{ name: 'X', status: 'Done', module: null }] }, 'now')
  expect(p.modules.find((m) => m.key === 'pe')!.assumed).toBe(false)
  expect(p.modules.find((m) => m.key === 'uw')!.assumed).toBe(true)
})

test('board stories count regardless of the module column (no routing)', () => {
  const p = assembleLivePayload(
    {
      bank: [{ name: 'Done thing', status: 'Done', module: null }],
      pl: [{ name: 'PL story', status: 'Ready to start', module: 'Tax Analyzer' }],
    },
    'now',
  )
  const bank = p.modules.find((m) => m.key === 'bank')!
  expect(bank.assumed).toBe(false)
  expect(bank.counts).toEqual({ delivered: 1, inProgress: 0, remaining: 0 })
  const pl = p.modules.find((m) => m.key === 'pl')!
  expect(pl.assumed).toBe(false)
  expect(pl.counts).toEqual({ delivered: 0, inProgress: 0, remaining: 1 })
})

test('boardless modules (vt/lexi/tax) never appear in the payload', () => {
  const p = assembleLivePayload({}, 'now')
  for (const k of ['vt', 'lexi', 'tax']) {
    expect(p.modules.find((m) => m.key === k)).toBeUndefined()
  }
})

test('attaches cleaned sub-tasks to their parent story without changing counts or percent', () => {
  const withSubs: RawStory[] = [
    { name: 'ID Analyzer', status: 'In Progress', module: null, subtasks: [
      { name: 'U-02-ID-01: Structured extraction', status: 'Done' },
      { name: 'U-02-ID-02: Provenance linking', status: '' },
    ] },
    { name: 'Extraction spike', status: 'Done', module: null },
  ]
  const m = buildDeliveryModule('id', withSubs)
  const item = m.buckets.inProgress[0]
  expect(item.title).toBe('ID Analyzer')
  expect(item.subtasks).toEqual([
    { title: 'Structured extraction', status: 'Done' },
    { title: 'Provenance linking', status: '' },
  ])

  const withoutSubs = buildDeliveryModule('id', [
    { name: 'ID Analyzer', status: 'In Progress', module: null },
    { name: 'Extraction spike', status: 'Done', module: null },
  ])
  expect(m.counts).toEqual(withoutSubs.counts)
  expect(m.percent).toBe(withoutSubs.percent)
})

test('a story with no sub-tasks yields a bucket item without a subtasks field', () => {
  const m = buildDeliveryModule('id', [{ name: 'Plain story', status: 'Done', module: null }])
  expect(m.buckets.delivered[0].subtasks).toBeUndefined()
})
