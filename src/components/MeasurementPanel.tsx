import type { MeasurementModule } from '../../shared/readiness'
import { ProgressBar } from './ProgressBar'
import { BucketColumn } from './BucketColumn'
import { MetricsTable } from './MetricsTable'

export function MeasurementPanel({ module: m }: { module: MeasurementModule }) {
  return (
    <div className="panel active" role="tabpanel">
      <div className="modband">
        <div>
          <div className="mtitle">{m.name}</div>
          <div className="msub">{m.sub}</div>
        </div>
        <div className="release">
          Target
          <b className="est">{m.targetDate}</b>
        </div>
      </div>
      <div className="row3">
        <div className="card">
          <div className="label">Production readiness</div>
          <div>
            <span className="bignum">{m.percent}<span className="unit">%</span></span>
            <span className="pill amber">{m.statusLabel}</span>
          </div>
          <ProgressBar percent={m.percent} />
          <div className="note">{m.note}</div>
        </div>
        <div className="card">
          <div className="label">Capabilities at standard</div>
          <div className="bignum">{m.capabilitiesAtStandard.count}<span className="unit"> of {m.capabilitiesAtStandard.of}</span></div>
        </div>
      </div>
      <div className="note">{m.gapNote}</div>
      <div className="buckets">
        <BucketColumn tone="green" title="Achieved" items={m.buckets.achieved} />
        <BucketColumn tone="amber" title="Holding" items={m.buckets.holding} />
        <BucketColumn tone="red" title="Must Complete" items={m.buckets.mustComplete} />
      </div>
      <details className="detail" open>
        <summary>By the numbers</summary>
        <MetricsTable metrics={m.metrics} />
      </details>
    </div>
  )
}
