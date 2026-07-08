import type { Module } from '../../shared/readiness'
import { ANALYZER_KEYS } from '../../shared/readiness'

export function partitionModules(modules: Module[]): { delivery: Module[]; analyzers: Module[] } {
  const analyzerSet = new Set<string>(ANALYZER_KEYS)
  const delivery = modules.filter((m) => !analyzerSet.has(m.key))
  const analyzers = ANALYZER_KEYS
    .map((k) => modules.find((m) => m.key === k))
    .filter((m): m is Module => m != null)
  return { delivery, analyzers }
}

export function globalAnalyzerPercent(analyzers: Module[]): number {
  let delivered = 0
  let total = 0
  for (const m of analyzers) {
    delivered += m.counts.delivered
    total += m.counts.delivered + m.counts.inProgress + m.counts.remaining
  }
  return total === 0 ? 0 : Math.round((delivered / total) * 100)
}
