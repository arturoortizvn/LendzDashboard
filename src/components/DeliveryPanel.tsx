import type { DeliveryModule, Status } from '../../shared/readiness'
import { ProgressBar } from './ProgressBar'
import { BucketColumn } from './BucketColumn'
import { AssumedBadge } from './AssumedBadge'

const PILL: Record<Status, string> = {
  on_track: 'green',
  in_progress: 'blue',
  early: 'grey',
  at_risk: 'amber',
  blocked: 'red',
}

export function DeliveryPanel({ module: m }: { module: DeliveryModule }) {
  return (
    <div className="panel active" role="tabpanel">
      <div className="modband" style={m.accentColor ? { borderLeftColor: m.accentColor } : undefined}>
        <div>
          <div className="mtitle">
            {m.name}
            {m.assumed && m.assumedLabel ? <> <AssumedBadge text={m.assumedLabel} /></> : null}
          </div>
          <div className="msub">{m.sub}</div>
        </div>
        <div className="release">
          Target
          <b className={m.dateConfidence === 'projected' ? 'est' : ''}>{m.targetDate}</b>
        </div>
      </div>
      <div className="row3">
        <div className="card">
          <div className="label">Delivery progress</div>
          <div>
            <span className="bignum">{m.percent}<span className="unit">%</span></span>
            <span className={`pill ${PILL[m.status]}`}>{m.statusLabel}</span>
          </div>
          <ProgressBar percent={m.percent} color={m.accentColor} />
          <div className="note">{m.note}</div>
        </div>
        <div className="card">
          <div className="label">In progress</div>
          <div className="bignum">{m.counts.inProgress}</div>
        </div>
        <div className="card">
          <div className="label">Remaining</div>
          <div className="bignum">{m.counts.remaining}</div>
        </div>
      </div>
      <div className="buckets">
        <BucketColumn tone="green" title="Delivered" count={`${m.counts.delivered} stories`} items={m.buckets.delivered} />
        <BucketColumn tone="amber" title="In Progress" count={`${m.counts.inProgress} stories`} items={m.buckets.inProgress} />
        <BucketColumn tone="grey" title="Remaining" count={`${m.counts.remaining} stories`} items={m.buckets.remaining} />
      </div>
    </div>
  )
}
