import { expect, test } from 'vitest'
import {
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  statusFromPercent,
  DELIVERY_KEYS,
} from './config'

test('maps Monday statuses to buckets, unknown/blank → remaining', () => {
  expect(bucketForStatus('Done')).toBe('delivered')
  expect(bucketForStatus('In Progress')).toBe('inProgress')
  expect(bucketForStatus('Code Review')).toBe('inProgress')
  expect(bucketForStatus('QA')).toBe('inProgress')
  expect(bucketForStatus('Ready to start')).toBe('remaining')
  expect(bucketForStatus('Stuck')).toBe('remaining')
  expect(bucketForStatus('')).toBe('remaining')
  expect(bucketForStatus(null)).toBe('remaining')
  expect(bucketForStatus('Whatever')).toBe('remaining')
})

test('maps Module column labels to keys', () => {
  expect(moduleKeyForLabel('Pricing & Eligibility')).toBe('pe')
  expect(moduleKeyForLabel('ID Analyzer')).toBe('id')
  expect(moduleKeyForLabel(null)).toBeNull()
  expect(moduleKeyForLabel('Not a module')).toBeNull()
})

test('derives the status pill from percent thresholds', () => {
  expect(statusFromPercent(65)).toBe('on_track')
  expect(statusFromPercent(64)).toBe('in_progress')
  expect(statusFromPercent(40)).toBe('in_progress')
  expect(statusFromPercent(39)).toBe('early')
})

test('cleanTitle strips sprint and id prefixes but leaves plain titles', () => {
  expect(cleanTitle('S1 · F-Elig-03 · Eligibility results')).toBe('Eligibility results')
  expect(cleanTitle('F-01-06 · Eligibility evaluation')).toBe('Eligibility evaluation')
  expect(cleanTitle('L-GenUI-05 · Direct Agent Field Updates')).toBe('Direct Agent Field Updates')
  expect(cleanTitle('CLTV calculation issue')).toBe('CLTV calculation issue')
})

test('DELIVERY_KEYS excludes bank and is in PoC order', () => {
  expect(DELIVERY_KEYS).toEqual(['pe', 'vt', 'uw', 'lexi', 'id', 'tax'])
})
