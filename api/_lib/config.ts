import type { Status } from '../../shared/readiness.js'

export const BOARD_ID = 18402839374

export type ModuleKey = 'pe' | 'vt' | 'uw' | 'lexi' | 'bank' | 'id' | 'tax'

export const DELIVERY_KEYS: readonly ModuleKey[] = ['pe', 'vt', 'uw', 'lexi', 'id', 'tax']

export const FORCE_ASSUMED: ReadonlySet<ModuleKey> = new Set<ModuleKey>(['vt', 'id', 'tax'])

export type Bucket = 'delivered' | 'inProgress' | 'remaining'

export const STATUS_BUCKET: Record<string, Bucket> = {
  Done: 'delivered',
  'In Progress': 'inProgress',
  'Code Review': 'inProgress',
  QA: 'inProgress',
  'Ready to start': 'remaining',
  Stuck: 'remaining',
  '': 'remaining',
}

export function bucketForStatus(status: string | null | undefined): Bucket {
  return STATUS_BUCKET[status ?? ''] ?? 'remaining'
}

export const MODULE_LABELS: Record<string, ModuleKey> = {
  'Pricing and Eligibility': 'pe',
  'Verified Truth': 'vt',
  Underwriting: 'uw',
  'Lexi Intelligence': 'lexi',
  'ID Analyzer': 'id',
  'Tax Analyzer': 'tax',
  'Bank Analyzer': 'bank',
}

export function moduleKeyForLabel(label: string | null | undefined): ModuleKey | null {
  if (!label) return null
  return MODULE_LABELS[label] ?? null
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

export const MODULE_COLUMN_ID = 'color_mm4e3r3v'

export function getModuleColumnId(): string {
  return process.env.MONDAY_MODULE_COLUMN_ID || MODULE_COLUMN_ID
}

export function getBoardId(): number {
  return Number(process.env.ID_MONDAY) || BOARD_ID
}

export function getCronSecret(): string {
  const s = process.env.CRON_SECRET
  if (!s) throw new Error('CRON_SECRET is not set')
  return s
}
