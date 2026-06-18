import type { BucketItem, DeliveryModule, Module, ReadinessPayload } from '../../shared/readiness.js'
import { MODULES_BY_KEY } from '../../shared/readiness.js'
import type { RawStory } from './monday.js'
import {
  DELIVERY_KEYS,
  bucketForStatus,
  cleanTitle,
  moduleKeyForLabel,
  statusFromPercent,
  STATUS_LABELS,
} from './config.js'

export function buildDeliveryModule(key: string, stories: RawStory[]): DeliveryModule {
  const base = MODULES_BY_KEY[key] as DeliveryModule
  if (stories.length === 0) {
    return { ...base, assumed: true }
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

export function buildDeliveryModules(stories: RawStory[]): Record<string, DeliveryModule> {
  const byKey: Record<string, RawStory[]> = {}
  for (const k of DELIVERY_KEYS) byKey[k] = []
  for (const s of stories) {
    const key = moduleKeyForLabel(s.module)
    if (key && key !== 'bank' && byKey[key]) byKey[key].push(s)
  }
  const result: Record<string, DeliveryModule> = {}
  for (const k of DELIVERY_KEYS) result[k] = buildDeliveryModule(k, byKey[k])
  return result
}

export function assembleLivePayload(stories: RawStory[], now: string): ReadinessPayload {
  const d = buildDeliveryModules(stories)
  const bank = MODULES_BY_KEY['bank']
  const modules: Module[] = [d.pe, d.vt, d.uw, d.lexi, bank, d.id, d.tax]
  return { asOf: now, builtAt: now, source: 'live', modules }
}
