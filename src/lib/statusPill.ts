import type { Status } from '../../shared/readiness'

export const STATUS_PILL: Record<Status, string> = {
  on_track: 'green',
  in_progress: 'blue',
  early: 'grey',
  at_risk: 'amber',
  blocked: 'red',
}
