import type { ReadinessPayload } from '../shared/readiness'

export async function fetchReadiness(
  getToken: () => Promise<string | null>,
  signal?: AbortSignal,
): Promise<ReadinessPayload> {
  const token = await getToken()
  const res = await fetch('/api/readiness', {
    signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    throw new Error(`Failed to load readiness data (${res.status})`)
  }
  return (await res.json()) as ReadinessPayload
}
