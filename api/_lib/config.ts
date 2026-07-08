import type { Status } from '../../shared/readiness.js'
import { MODULE_KEYS } from '../../shared/readiness.js'

export type ModuleKey = 'pe' | 'vt' | 'uw' | 'lexi' | 'bank' | 'id' | 'pl' | 'paystub' | 'tax'

export { ANALYZER_KEYS } from '../../shared/readiness.js'

// Canonical module order, derived from the single MODULES source so live and
// baseline payloads can never drift in ordering.
export const MODULE_ORDER = MODULE_KEYS as readonly ModuleKey[]

// One dedicated Monday board per module, read whole (no module-column routing).
// null = board does not exist yet, so the module stays hidden until an id is set.
const MODULE_BOARD_DEFAULTS: Record<ModuleKey, number | null> = {
  pe: 18420951236,
  vt: null,
  uw: 18420951193,
  lexi: null,
  bank: 18420951194,
  id: 18420951197,
  pl: 18420951201,
  paystub: 18420951200,
  tax: null,
}

const MODULE_BOARD_ENV: Record<ModuleKey, string> = {
  pe: 'ID_MONDAY_PE',
  vt: 'ID_MONDAY_VT',
  uw: 'ID_MONDAY_UW',
  lexi: 'ID_MONDAY_LEXI',
  bank: 'ID_MONDAY_BANK',
  id: 'ID_MONDAY_ID',
  pl: 'ID_MONDAY_PL',
  paystub: 'ID_MONDAY_PAYSTUB',
  tax: 'ID_MONDAY_TAX',
}

export function getModuleBoardId(key: ModuleKey): number | null {
  const n = Number(process.env[MODULE_BOARD_ENV[key]])
  if (Number.isFinite(n) && n > 0) return n
  return MODULE_BOARD_DEFAULTS[key]
}

export function boardBackedKeys(): ModuleKey[] {
  return MODULE_ORDER.filter((k) => getModuleBoardId(k) != null)
}

export type Bucket = 'delivered' | 'inProgress' | 'remaining'

export const STATUS_BUCKET: Record<string, Bucket> = {
  Done: 'delivered',
  'In Progress': 'inProgress',
  'Working on it': 'inProgress',
  'Code Review': 'inProgress',
  QA: 'inProgress',
  'Ready to start': 'remaining',
  'Not Started': 'remaining',
  Stuck: 'remaining',
  '': 'remaining',
}

export function bucketForStatus(status: string | null | undefined): Bucket {
  return STATUS_BUCKET[status ?? ''] ?? 'remaining'
}

export function statusFromPercent(percent: number): Status {
  if (percent >= 65) return 'on_track'
  if (percent >= 40) return 'in_progress'
  return 'early'
}

export const STATUS_LABELS: Record<Status, string> = {
  on_track: 'On track',
  in_progress: 'In progress',
  early: 'Early build',
  at_risk: 'At risk',
  blocked: 'Blocked',
}

export function cleanTitle(name: string): string {
  return name
    .replace(/^S\d+\s*·\s*/, '')
    .replace(/^[A-Z]+-[\w-]+\s*·\s*/, '')
    .trim()
}

export function getMondayToken(): string {
  const t = process.env.MONDAY_API_TOKEN
  if (!t) throw new Error('MONDAY_API_TOKEN is not set')
  return t
}

export function getCronSecret(): string {
  const s = process.env.CRON_SECRET
  if (!s) throw new Error('CRON_SECRET is not set')
  return s
}
