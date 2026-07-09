import type { DeliveryModule } from '../../shared/readiness'
import { ProgressBar } from './ProgressBar'
import { BucketColumn } from './BucketColumn'
import { AssumedBadge } from './AssumedBadge'
import { STATUS_PILL } from '../lib/statusPill'

export function DeliveryPanel({ module: m }: { module: DeliveryModule }) {
  const brief = m.brief
  const hasDates = brief && (brief.goNoGo || brief.goLive)
  return (
    <div className="panel active" role="tabpanel">
      <div className="modband" style={m.accentColor ? { borderLeftColor: m.accentColor } : undefined}>
        <div>
          <div className="mtitle">
            {m.name}
            {m.assumed && m.assumedLabel ? <> <AssumedBadge text={m.assumedLabel} /></> : null}
            {brief?.programStatus ? <> <span className={`pill ${STATUS_PILL[brief.programStatus]}`}>{brief.programStatusLabel}</span></> : null}
          </div>
          <div className="msub">{m.sub}</div>
          {brief?.statusLine ? <div className="statusline">{brief.statusLine}</div> : null}
        </div>
        {hasDates ? (
          <div className="release datestrip">
            {brief.goNoGo ? <div><span className="dlabel">Go / No-Go</span><b>{brief.goNoGo}</b></div> : null}
            {brief.goLive ? <div><span className="dlabel">Go Live</span><b>{brief.goLive}</b></div> : null}
          </div>
        ) : (
          <div className="release">
            Target
            <b className={m.dateConfidence === 'projected' ? 'est' : ''}>{m.targetDate}</b>
          </div>
        )}
      </div>
      {brief?.detail ? (
        <details className="detail cardetail">
          <summary>Phase 1 detail</summary>
          <div className="detailbody">
            <div className="dgroup">
              <div className="dgtitle">Phase 1 scope</div>
              <ul>{brief.detail.phaseScope.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div className="dgroup">
              <div className="dgtitle">Analyzer status</div>
              <ul>{brief.detail.analyzerStatus.map((a, i) => <li key={i}><b>{a.name}</b>: {a.note}</li>)}</ul>
            </div>
          </div>
        </details>
      ) : null}
      <div className="row3">
        <div className="card">
          <div className="label">Delivery progress</div>
          <div>
            <span className="bignum">{m.percent}<span className="unit">%</span></span>
            <span className={`pill ${STATUS_PILL[m.status]}`}>{m.statusLabel}</span>
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
