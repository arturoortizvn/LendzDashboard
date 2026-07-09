import { expect, test } from 'vitest'
import { partitionModules, globalAnalyzerPercent } from './analyzers'
import type { Module } from '../../shared/readiness'

const mk = (key: string, d: number, ip: number, r: number): Module => ({
  key,
  name: key,
  sub: '',
  phase: 'delivery',
  percent: 0,
  status: 'early',
  statusLabel: '',
  note: '',
  targetDate: '',
  dateConfidence: 'projected',
  assumed: false,
  counts: { delivered: d, inProgress: ip, remaining: r },
  buckets: { delivered: [], inProgress: [], remaining: [] },
}) as Module

test('partitionModules splits delivery vs analyzers, analyzers in canonical order', () => {
  const modules = [
    mk('pe', 0, 0, 0), mk('bank', 0, 0, 0), mk('id', 0, 0, 0), mk('pl', 0, 0, 0),
    mk('paystub', 0, 0, 0), mk('tax', 0, 0, 0), mk('vt', 0, 0, 0),
  ]
  const { delivery, analyzers } = partitionModules(modules)
  expect(delivery.map((m) => m.key)).toEqual(['pe', 'vt'])
  expect(analyzers.map((m) => m.key)).toEqual(['bank', 'id', 'pl', 'paystub', 'tax'])
})

test('globalAnalyzerPercent is story-weighted across analyzers, in-progress at half credit', () => {
  const analyzers = [mk('bank', 2, 0, 1), mk('id', 0, 1, 2)]
  expect(globalAnalyzerPercent(analyzers)).toBe(42) // (2 + 0.5·1) / 6
})

test('globalAnalyzerPercent is 0 when there are no stories', () => {
  expect(globalAnalyzerPercent([mk('bank', 0, 0, 0)])).toBe(0)
})

test('globalAnalyzerPercent excludes assumed modules from the weighted sum', () => {
  const live = mk('bank', 2, 0, 1)          // 2/3 real
  const assumed = { ...mk('tax', 1, 1, 3), assumed: true } as Module
  expect(globalAnalyzerPercent([live, assumed])).toBe(67) // 2/3 only; assumed tax ignored
})

test('globalAnalyzerPercent is 0 when every analyzer is assumed', () => {
  const a = { ...mk('bank', 1, 1, 1), assumed: true } as Module
  const b = { ...mk('id', 2, 0, 0), assumed: true } as Module
  expect(globalAnalyzerPercent([a, b])).toBe(0)
})

test('partitionModules skips analyzer keys missing from the payload', () => {
  const modules = [mk('pe',0,0,0), mk('bank',0,0,0), mk('id',0,0,0), mk('tax',0,0,0)]
  const { delivery, analyzers } = partitionModules(modules)
  expect(delivery.map((m) => m.key)).toEqual(['pe'])
  expect(analyzers.map((m) => m.key)).toEqual(['bank', 'id', 'tax']) // pl/paystub absent, no undefined
})
