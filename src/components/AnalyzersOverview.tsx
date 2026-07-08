import type { Module } from '../../shared/readiness'
import { ProgressBar } from './ProgressBar'
import { globalAnalyzerPercent } from '../lib/analyzers'
import { STATUS_PILL } from '../lib/statusPill'

export function AnalyzersOverview({ analyzers, onSelect }: {
  analyzers: Module[]
  onSelect: (key: string) => void
}) {
  const pct = globalAnalyzerPercent(analyzers)
  return (
    <div className="panel active" role="tabpanel">
      <div className="card">
        <div className="label">Analyzer readiness</div>
        <div><span className="bignum">{pct}<span className="unit">%</span></span></div>
        <ProgressBar percent={pct} />
        <div className="note">Combined across {analyzers.length} analyzers.</div>
      </div>
      <div className="analyzer-grid">
        {analyzers.map((m) => (
          <button
            key={m.key}
            type="button"
            className="analyzer-card"
            onClick={() => onSelect(m.key)}
            style={m.accentColor ? { borderLeftColor: m.accentColor } : undefined}
          >
            <div className="ac-name">{m.name}</div>
            <div>
              <span className="ac-pct">{m.percent}%</span>
              <span className={`pill ${STATUS_PILL[m.status]}`}>{m.statusLabel}</span>
            </div>
            <ProgressBar percent={m.percent} color={m.accentColor} />
          </button>
        ))}
      </div>
    </div>
  )
}
