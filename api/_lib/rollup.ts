import type { BucketItem, DeliveryModule, Module, ReadinessPayload } from '../../shared/readiness.js'
import { MODULES_BY_KEY } from '../../shared/readiness.js'
import type { RawStory } from './monday.js'
import {
  DELIVERY_KEYS,
  FORCE_ASSUMED,
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  SHARED_LABEL,
  statusFromPercent,
  STATUS_LABELS,
  type ModuleKey,
  type DedicatedAnalyzerKey,
} from './config.js'

export function buildDeliveryModule(key: string, stories: RawStory[]): DeliveryModule {
  const base = MODULES_BY_KEY[key] as DeliveryModule
  if (FORCE_ASSUMED.has(key as ModuleKey) || stories.length === 0) {
    return { ...base, assumed: true, assumedLabel: base.assumedLabel ?? 'Awaiting board data' }
  }

  const buckets = {
    delivered: [] as BucketItem[],
    inProgress: [] as BucketItem[],
    remaining: [] as BucketItem[],
  }
  for (const s of stories) {
    buckets[bucketForStatus(s.status)].push({ title: cleanTitle(s.name) })
  }

  const counts = {
    delivered: buckets.delivered.length,
    inProgress: buckets.inProgress.length,
    remaining: buckets.remaining.length,
  }
  const total = counts.delivered + counts.inProgress + counts.remaining
  const percent = Math.round((counts.delivered / total) * 100)
  const status = statusFromPercent(percent)

  return {
    ...base,
    assumed: false,
    percent,
    status,
    statusLabel: STATUS_LABELS[status],
    note: `${counts.delivered} of ${total} stories accepted.`,
    counts,
    buckets,
  }
}

function buildModulesForKeys(stories: RawStory[], keys: readonly ModuleKey[]): Record<string, DeliveryModule> {
  const byKey: Record<string, RawStory[]> = {}
  for (const k of keys) byKey[k] = []
  for (const s of stories) {
    if (s.module === SHARED_LABEL) {
      for (const k of keys) byKey[k].push(s)
      continue
    }
    const key = moduleKeyForLabel(s.module)
    if (key && byKey[key]) byKey[key].push(s)
  }
  const result: Record<string, DeliveryModule> = {}
  for (const k of keys) result[k] = buildDeliveryModule(k, byKey[k])
  return result
}

export function buildDeliveryModules(stories: RawStory[]): Record<string, DeliveryModule> {
  return buildModulesForKeys(stories, DELIVERY_KEYS)
}

const TAX_ONLY: readonly ModuleKey[] = ['tax']

export function buildTaxModule(stories: RawStory[]): DeliveryModule {
  return buildModulesForKeys(stories, TAX_ONLY).tax
}

export function assembleLivePayload(
  deliveryStories: RawStory[],
  dedicated: Record<DedicatedAnalyzerKey, RawStory[]>,
  taxStories: RawStory[],
  now: string,
): ReadinessPayload {
  const d = buildDeliveryModules(deliveryStories)
  const bank = buildDeliveryModule('bank', dedicated.bank)
  const id = buildDeliveryModule('id', dedicated.id)
  const pl = buildDeliveryModule('pl', dedicated.pl)
  const paystub = buildDeliveryModule('paystub', dedicated.paystub)
  const tax = buildTaxModule(taxStories)
  const modules: Module[] = [d.pe, d.vt, d.uw, d.lexi, bank, id, pl, paystub, tax]
  return { asOf: now, builtAt: now, source: 'live', modules }
}
