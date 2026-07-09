import type { BucketItem, DeliveryModule, Module, ReadinessPayload } from '../../shared/readiness.js'
import { MODULES_BY_KEY, creditedPercent } from '../../shared/readiness.js'
import type { RawStory } from './monday.js'
import {
  bucketForStatus,
  cleanTitle,
  cleanSubtaskTitle,
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
    const item: BucketItem = { title: cleanTitle(s.name) }
    const subs = s.subtasks ?? []
    if (subs.length) {
      item.subtasks = subs.map((t) => ({ title: cleanSubtaskTitle(t.name), status: t.status }))
    }
    buckets[bucketForStatus(s.status)].push(item)
  }

  const counts = {
    delivered: buckets.delivered.length,
    inProgress: buckets.inProgress.length,
    remaining: buckets.remaining.length,
  }
  const total = counts.delivered + counts.inProgress + counts.remaining
  const percent = creditedPercent(counts.delivered, counts.inProgress, total)
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
