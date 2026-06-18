import type { ReadinessPayload } from '../shared/readiness'

export async function fetchReadiness(signal?: AbortSignal): Promise<ReadinessPayload> {
  const res = await fetch('/api/readiness', { signal })
  if (!res.ok) {
    throw new Error(`Failed to load readiness data (${res.status})`)
  }
  return (await res.json()) as ReadinessPayload
}
