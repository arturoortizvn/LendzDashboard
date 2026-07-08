import { expect, test } from 'vitest'
import {
  bucketForStatus,
  cleanTitle,
  statusFromPercent,
  ANALYZER_KEYS,
  MODULE_ORDER,
  getModuleBoardId,
  boardBackedKeys,
} from './config'

test('maps Monday statuses to buckets, unknown/blank → remaining', () => {
  expect(bucketForStatus('Done')).toBe('delivered')
  expect(bucketForStatus('In Progress')).toBe('inProgress')
  expect(bucketForStatus('Code Review')).toBe('inProgress')
  expect(bucketForStatus('QA')).toBe('inProgress')
  expect(bucketForStatus('Working on it')).toBe('inProgress')
  expect(bucketForStatus('Ready to start')).toBe('remaining')
  expect(bucketForStatus('Not Started')).toBe('remaining')
  expect(bucketForStatus('Stuck')).toBe('remaining')
  expect(bucketForStatus('')).toBe('remaining')
  expect(bucketForStatus(null)).toBe('remaining')
  expect(bucketForStatus('Whatever')).toBe('remaining')
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

test('ANALYZER_KEYS are bank/id/pl/paystub/tax', () => {
  expect(ANALYZER_KEYS).toEqual(['bank', 'id', 'pl', 'paystub', 'tax'])
})

test('MODULE_ORDER is the canonical nine-module order', () => {
  expect(MODULE_ORDER).toEqual(['pe', 'vt', 'uw', 'lexi', 'bank', 'id', 'pl', 'paystub', 'tax'])
})

test('getModuleBoardId: default, env override, invalid/unset falls back to default', () => {
  const orig = process.env.ID_MONDAY_PE
  delete process.env.ID_MONDAY_PE
  expect(getModuleBoardId('pe')).toBe(18420951236)
  process.env.ID_MONDAY_PE = 'not-a-number'
  expect(getModuleBoardId('pe')).toBe(18420951236)
  process.env.ID_MONDAY_PE = '0'
  expect(getModuleBoardId('pe')).toBe(18420951236)
  process.env.ID_MONDAY_PE = '999'
  expect(getModuleBoardId('pe')).toBe(999)
  process.env.ID_MONDAY_PE = orig
})

test('getModuleBoardId is null for modules whose board does not exist yet', () => {
  for (const k of ['vt', 'lexi', 'tax'] as const) {
    const env = { vt: 'ID_MONDAY_VT', lexi: 'ID_MONDAY_LEXI', tax: 'ID_MONDAY_TAX' }[k]
    const orig = process.env[env]
    delete process.env[env]
    expect(getModuleBoardId(k)).toBeNull()
    process.env[env] = orig
  }
})

test('an env override makes a boardless module visible', () => {
  const orig = process.env.ID_MONDAY_TAX
  delete process.env.ID_MONDAY_TAX
  expect(getModuleBoardId('tax')).toBeNull()
  process.env.ID_MONDAY_TAX = '12345'
  expect(getModuleBoardId('tax')).toBe(12345)
  expect(boardBackedKeys()).toContain('tax')
  if (orig === undefined) delete process.env.ID_MONDAY_TAX
  else process.env.ID_MONDAY_TAX = orig
})

test('boardBackedKeys are the six board-backed modules in canonical order', () => {
  expect(boardBackedKeys()).toEqual(['pe', 'uw', 'bank', 'id', 'pl', 'paystub'])
})
