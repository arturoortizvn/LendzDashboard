import { expect, test } from 'vitest'
import {
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  statusFromPercent,
  DELIVERY_KEYS,
  FORCE_ASSUMED,
  getBoardId,
  BOARD_ID,
  ANALYZER_KEYS,
  getAnalyzerBoardId,
  getAnalyzerColumnId,
  ANALYZER_BOARD_ID,
  DEDICATED_ANALYZER_KEYS,
  DEDICATED_ANALYZER_BOARDS,
  getDedicatedAnalyzerBoardId,
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
  expect(moduleKeyForLabel('Pricing and Eligibility')).toBe('pe')
  expect(moduleKeyForLabel('Lexi Intelligence')).toBe('lexi')
  expect(moduleKeyForLabel('Tax Analyzer')).toBe('tax')
  expect(moduleKeyForLabel('Bank Analyzer')).toBe('bank')
  expect(moduleKeyForLabel('ID Analyzer')).toBe('id')
  expect(moduleKeyForLabel('Platform')).toBeNull()
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

test('DELIVERY_KEYS are the Stories-board modules', () => {
  expect(DELIVERY_KEYS).toEqual(['pe', 'vt', 'uw', 'lexi'])
})

test('FORCE_ASSUMED is empty — no modules are force-assumed', () => {
  expect([...FORCE_ASSUMED]).toEqual([])
})

test('getBoardId returns BOARD_ID for 0, invalid, or unset; returns parsed number for valid ids', () => {
  const orig = process.env.ID_MONDAY

  process.env.ID_MONDAY = '0'
  expect(getBoardId()).toBe(BOARD_ID)

  process.env.ID_MONDAY = 'not-a-number'
  expect(getBoardId()).toBe(BOARD_ID)

  process.env.ID_MONDAY = '99999'
  expect(getBoardId()).toBe(99999)

  process.env.ID_MONDAY = orig
})

test('maps the Analyzers-board statuses to buckets', () => {
  expect(bucketForStatus('Working on it')).toBe('inProgress')
  expect(bucketForStatus('Not Started')).toBe('remaining')
})

test('maps the Analyzers Module labels to keys', () => {
  expect(moduleKeyForLabel('Bank')).toBe('bank')
  expect(moduleKeyForLabel('ID')).toBe('id')
  expect(moduleKeyForLabel('Tax')).toBe('tax')
})

test('ANALYZER_KEYS are bank/id/pl/paystub/tax', () => {
  expect(ANALYZER_KEYS).toEqual(['bank', 'id', 'pl', 'paystub', 'tax'])
})

test('DEDICATED_ANALYZER_KEYS are the four own-board analyzers', () => {
  expect(DEDICATED_ANALYZER_KEYS).toEqual(['bank', 'id', 'pl', 'paystub'])
})

test('DEDICATED_ANALYZER_BOARDS maps each analyzer to its default board id', () => {
  expect(DEDICATED_ANALYZER_BOARDS).toEqual({
    bank: 18420951194,
    id: 18420951197,
    pl: 18420951201,
    paystub: 18420951200,
  })
})

test('getDedicatedAnalyzerBoardId returns the default when the env is unset/invalid, else the parsed override', () => {
  const orig = process.env.ID_MONDAY_BANK
  delete process.env.ID_MONDAY_BANK
  expect(getDedicatedAnalyzerBoardId('bank')).toBe(18420951194)
  process.env.ID_MONDAY_BANK = 'not-a-number'
  expect(getDedicatedAnalyzerBoardId('bank')).toBe(18420951194)
  process.env.ID_MONDAY_BANK = '55555'
  expect(getDedicatedAnalyzerBoardId('bank')).toBe(55555)
  process.env.ID_MONDAY_BANK = orig
})

test('getAnalyzerBoardId returns ANALYZER_BOARD_ID for unset/invalid; parses valid ids', () => {
  const orig = process.env.ID_MONDAY_ANALYZERS
  delete process.env.ID_MONDAY_ANALYZERS
  expect(getAnalyzerBoardId()).toBe(ANALYZER_BOARD_ID)
  process.env.ID_MONDAY_ANALYZERS = '12345'
  expect(getAnalyzerBoardId()).toBe(12345)
  process.env.ID_MONDAY_ANALYZERS = orig
})

test('getAnalyzerColumnId returns empty string when unset', () => {
  const orig = process.env.MONDAY_ANALYZER_COLUMN_ID
  delete process.env.MONDAY_ANALYZER_COLUMN_ID
  expect(getAnalyzerColumnId()).toBe('')
  process.env.MONDAY_ANALYZER_COLUMN_ID = 'color_x'
  expect(getAnalyzerColumnId()).toBe('color_x')
  process.env.MONDAY_ANALYZER_COLUMN_ID = orig
})
