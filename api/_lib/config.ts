import type { Status } from '../../shared/readiness.js'
import { MODULE_KEYS } from '../../shared/readiness.js'
import type { RawStory } from './monday.js'

export type ModuleKey = 'pe' | 'vt' | 'uw' | 'lexi' | 'broker' | 'bank' | 'id' | 'pl' | 'paystub' | 'tax'

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
  lexi: 18420631446,
  broker: 18420631446,
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
  broker: 'ID_MONDAY_BROKER',
  bank: 'ID_MONDAY_BANK',
  id: 'ID_MONDAY_ID',
  pl: 'ID_MONDAY_PL',
  paystub: 'ID_MONDAY_PAYSTUB',
  tax: 'ID_MONDAY_TAX',
}

// Most boards keep their story status in `task_status`; the Broker LOS board uses
// the Monday-default `status` column. Per-module so a new board must declare its own.
const MODULE_STATUS_COLUMN: Record<ModuleKey, string> = {
  pe: 'task_status',
  vt: 'task_status',
  uw: 'task_status',
  lexi: 'status',
  broker: 'status',
  bank: 'task_status',
  id: 'task_status',
  pl: 'task_status',
  paystub: 'task_status',
  tax: 'task_status',
}

// The Broker LOS board is shared: these Lexi-scoped items feed the `lexi` module,
// the rest feed `broker`. Monday is not modified; routing lives here, keyed by item id.
export const LEXI_BROKER_BOARD_ID = 18420631446
const LEXI_ITEM_IDS: ReadonlySet<string> = new Set([
  '12451013226', // Lexi Intelligence — extract into a microservice
  '12482521999', // Generative UI
  '12482526623', // Agent loop
  '12451140139', // Lexi AI assistant (advisory, wizard-first)
  '12451122951', // Lexi capability standard + tool roadmap
  '12451013290', // Lexi document upload (chat attachments)
  '12451008846', // AI — Anthropic Claude (.NET SDK)
])

export function filterStoriesForModule(
  key: ModuleKey,
  boardId: number,
  stories: RawStory[],
): RawStory[] {
  if (boardId !== LEXI_BROKER_BOARD_ID) return stories
  if (key === 'lexi') return stories.filter((s) => LEXI_ITEM_IDS.has(s.id))
  if (key === 'broker') return stories.filter((s) => !LEXI_ITEM_IDS.has(s.id))
  return stories
}

export function getModuleBoardId(key: ModuleKey): number | null {
  const n = Number(process.env[MODULE_BOARD_ENV[key]])
  if (Number.isFinite(n) && n > 0) return n
  return MODULE_BOARD_DEFAULTS[key]
}

export function getModuleStatusColumnId(key: ModuleKey): string {
  return MODULE_STATUS_COLUMN[key]
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

export const SUBITEM_STATUS_COLUMN_ID = 'status'

export function cleanSubtaskTitle(name: string): string {
  return name.replace(/^[A-Z0-9]+(?:-[A-Z0-9]+)+:\s*/, '').trim()
}

export function getMondayToken(): string {
  const t = process.env.MONDAY_API_TOKEN
  if (!t) throw new Error('MONDAY_API_TOKEN is not set')
  return t
}
