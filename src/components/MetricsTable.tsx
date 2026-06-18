import type { Metric } from '../../shared/readiness'
import { InfoTooltip } from './InfoTooltip'

const STATUS_CLASS: Record<Metric['status'], string> = {
  at_target: 'ok',
  near: 'near',
  blocked: 'blk',
  no_target: 'none',
}

export function MetricsTable({ metrics }: { metrics: Metric[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Capability</th>
          <th>Weight</th>
          <th>
            Current
            <InfoTooltip flipLeft>
              Where the metric sits today. "Not emitted" means the analyzer does not yet produce this output. "Measured / TBD" means data flows but no target exists to score against.
            </InfoTooltip>
          </th>
          <th>Target</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map((m) => (
          <tr key={m.capability}>
            <td>{m.capability}</td>
            <td>{m.weight}%</td>
            <td>{m.current}</td>
            <td>{m.target}</td>
            <td><span className={`st ${STATUS_CLASS[m.status]}`}>{m.statusLabel}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
