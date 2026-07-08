import type { BucketItem, DeliveryModule, Module, ReadinessPayload } from '../../shared/readiness.js'
import { MODULES_BY_KEY } from '../../shared/readiness.js'
import type { RawStory } from './monday.js'
import {
  bucketForStatus,
  cleanTitle,
  statusFromPercent,
  STATUS_LABELS,
  boardBackedKeys,
  type ModuleKey,
} from './config.js'

export function buildDeliveryModule(key: string, stories: RawStory[]): DeliveryModule {
  const base = MODULES_BY_KEY[key] as DeliveryModule
  if (stories.length === 0) {
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

export function assembleLivePayload(
  storiesByModule: Partial<Record<ModuleKey, RawStory[]>>,
  now: string,
): ReadinessPayload {
  const modules: Module[] = boardBackedKeys().map((k) => buildDeliveryModule(k, storiesByModule[k] ?? []))
  return { asOf: now, builtAt: now, source: 'live', modules }
}
