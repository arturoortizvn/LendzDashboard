import { expect, test } from 'vitest'
import { assembleLivePayload, buildDeliveryModule } from './rollup'
import { MODULES_BY_KEY } from '../../shared/readiness'
import type { DeliveryModule } from '../../shared/readiness'
import type { RawStory } from './monday'

test('rolls up counts, percent, status, note, and cleaned titles', () => {
  const stories: RawStory[] = [
    { name: 'F-01-06 · Eligibility evaluation', status: 'Done', module: 'Pricing & Eligibility' },
    { name: 'CLTV calculation issue', status: 'In Progress', module: 'Pricing & Eligibility' },
    { name: 'Series 2 rules', status: 'Ready to start', module: 'Pricing & Eligibility' },
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

test('assembleLivePayload returns 7 modules in PoC order, bank from fixture, source live', () => {
  const p = assembleLivePayload([], '2026-06-18T00:00:00Z')
  expect(p.modules.map((m) => m.key)).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'tax'])
  expect(p.source).toBe('live')
  expect(p.builtAt).toBe('2026-06-18T00:00:00Z')
  expect(p.modules.find((m) => m.key === 'bank')).toBe(MODULES_BY_KEY['bank'])
})

test('bank-labeled stories are ignored by the delivery rollup', () => {
  const stories: RawStory[] = [
    { name: 'U-02-01 · Bank Statement Analyzer', status: 'Done', module: 'Bank Analyzer' },
  ]
  const byKey = assembleLivePayload(stories, 'now')
  expect(byKey.modules.find((m) => m.key === 'bank')).toBe(MODULES_BY_KEY['bank'])
})

test('zero-stories assumed: module without base assumedLabel gets fallback label, module with base label preserves it', () => {
  const pe = buildDeliveryModule('pe', [])
  expect(pe.assumed).toBe(true)
  expect(pe.assumedLabel).toBe('Awaiting board data')

  const tax = buildDeliveryModule('tax', [])
  expect(tax.assumed).toBe(true)
  expect(tax.assumedLabel).toBe('Scaffolding done')
})

test('assembleLivePayload routes a real Module label to its delivery module', () => {
  const stories: RawStory[] = [
    { name: 'F-01-06 · Eligibility evaluation', status: 'Done', module: 'Pricing and Eligibility' },
  ]
  const p = assembleLivePayload(stories, '2026-06-18T00:00:00Z')
  const pe = p.modules.find((m) => m.key === 'pe') as DeliveryModule | undefined
  expect(pe?.assumed).toBe(false)
  expect(pe?.counts.delivered).toBe(1)
})
