import { expect, test } from 'vitest'
import { assembleLivePayload, buildDeliveryModule } from './rollup'
import { MODULES_BY_KEY } from '../../shared/readiness'
import type { RawStory } from './monday'

test('rolls up counts, percent, status, note, and cleaned titles', () => {
  const stories: RawStory[] = [
    { id: '1', name: 'F-01-06 · Eligibility evaluation', status: 'Done', module: null },
    { id: '2', name: 'CLTV calculation issue', status: 'In Progress', module: null },
    { id: '3', name: 'Series 2 rules', status: 'Ready to start', module: null },
  ]
  const m = buildDeliveryModule('pe', stories)
  expect(m.assumed).toBe(false)
  expect(m.counts).toEqual({ delivered: 1, inProgress: 1, remaining: 1 })
  expect(m.percent).toBe(50) // (1 delivered + 0.5·1 in-progress) / 3
  expect(m.status).toBe('in_progress')
  expect(m.statusLabel).toBe('In progress')
  expect(m.note).toBe('1 of 3 stories accepted.')
  expect(m.buckets.delivered[0].title).toBe('Eligibility evaluation')
  expect(m.buckets.inProgress[0].title).toBe('CLTV calculation issue')
  expect(m.buckets.remaining[0].title).toBe('Series 2 rules')
})

test('in-progress stories earn half credit toward percent', () => {
  const allInProgress = buildDeliveryModule('pe', [
    { id: '1', name: 'A', status: 'In Progress', module: null },
    { id: '2', name: 'B', status: 'Working on it', module: null },
  ])
  expect(allInProgress.counts).toEqual({ delivered: 0, inProgress: 2, remaining: 0 })
  expect(allInProgress.percent).toBe(50) // 0.5·2 / 2

  const mixed = buildDeliveryModule('pe', [
    { id: '1', name: 'A', status: 'Done', module: null },
    { id: '2', name: 'B', status: 'Code Review', module: null },
    { id: '3', name: 'C', status: 'QA', module: null },
    { id: '4', name: 'D', status: 'Not Started', module: null },
  ])
  expect(mixed.counts).toEqual({ delivered: 1, inProgress: 2, remaining: 1 })
  expect(mixed.percent).toBe(50) // (1 + 0.5·2) / 4
})

test('a live rebuild preserves the editorial brief (not overwritten by the rollup)', () => {
  const base = MODULES_BY_KEY['pe'] as { brief?: unknown }
  const m = buildDeliveryModule('pe', [{ id: '1', name: 'X', status: 'Done', module: null }])
  expect(m.assumed).toBe(false)
  expect(m.brief).toBe(base.brief)
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
  expect(p.modules.map((m) => m.key)).toEqual(['pe', 'uw', 'lexi', 'broker', 'bank', 'id', 'pl', 'paystub'])
  expect(p.source).toBe('live')
  expect(p.builtAt).toBe('2026-07-08T00:00:00Z')
  expect(p.asOf).toBe('2026-07-08T00:00:00Z')
})

test('a module with stories goes live; a board-backed module with none is assumed', () => {
  const p = assembleLivePayload({ pe: [{ id: '1', name: 'X', status: 'Done', module: null }] }, 'now')
  expect(p.modules.find((m) => m.key === 'pe')!.assumed).toBe(false)
  expect(p.modules.find((m) => m.key === 'uw')!.assumed).toBe(true)
})

test('board stories count regardless of the module column (no routing)', () => {
  const p = assembleLivePayload(
    {
      bank: [{ id: '1', name: 'Done thing', status: 'Done', module: null }],
      pl: [{ id: '2', name: 'PL story', status: 'Ready to start', module: 'Tax Analyzer' }],
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

test('boardless modules (vt/tax) never appear in the payload', () => {
  const p = assembleLivePayload({}, 'now')
  for (const k of ['vt', 'tax']) {
    expect(p.modules.find((m) => m.key === k)).toBeUndefined()
  }
})

test('lexi rolls up its seven routed stories: 3 delivered, 4 remaining, 43 percent, in_progress', () => {
  const lexiIds = [
    '12451013226', '12482521999', '12482526623', '12451140139',
    '12451122951', '12451013290', '12451008846',
  ]
  const stories: RawStory[] = lexiIds.map((id, i) => ({
    id,
    name: `Lexi ${id}`,
    status: i < 3 ? 'Done' : '',
    module: null,
  }))
  const m = buildDeliveryModule('lexi', stories)
  expect(m.assumed).toBe(false)
  expect(m.counts).toEqual({ delivered: 3, inProgress: 0, remaining: 4 })
  expect(m.percent).toBe(43)
  expect(m.status).toBe('in_progress')
  expect(m.note).toBe('3 of 7 stories accepted.')
})

test('attaches cleaned sub-tasks to their parent story without changing counts or percent', () => {
  const withSubs: RawStory[] = [
    { id: '1', name: 'ID Analyzer', status: 'In Progress', module: null, subtasks: [
      { name: 'U-02-ID-01: Structured extraction', status: 'Done' },
      { name: 'U-02-ID-02: Provenance linking', status: '' },
    ] },
    { id: '2', name: 'Extraction spike', status: 'Done', module: null },
  ]
  const m = buildDeliveryModule('id', withSubs)
  const item = m.buckets.inProgress[0]
  expect(item.title).toBe('ID Analyzer')
  expect(item.subtasks).toEqual([
    { title: 'Structured extraction', status: 'Done' },
    { title: 'Provenance linking', status: '' },
  ])

  const withoutSubs = buildDeliveryModule('id', [
    { id: '1', name: 'ID Analyzer', status: 'In Progress', module: null },
    { id: '2', name: 'Extraction spike', status: 'Done', module: null },
  ])
  expect(m.counts).toEqual(withoutSubs.counts)
  expect(m.percent).toBe(withoutSubs.percent)
})

test('a story with no sub-tasks yields a bucket item without a subtasks field', () => {
  const m = buildDeliveryModule('id', [{ id: '1', name: 'Plain story', status: 'Done', module: null }])
  expect(m.buckets.delivered[0].subtasks).toBeUndefined()
})
