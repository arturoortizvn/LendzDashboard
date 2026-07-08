import type { BucketItem } from '../../shared/readiness'
import { subtaskStatus } from '../lib/subtaskStatus'

type Tone = 'green' | 'amber' | 'grey' | 'red'

export function BucketColumn({ tone, title, count, items }: {
  tone: Tone
  title: string
  count?: string
  items: BucketItem[]
}) {
  return (
    <div className={`bucket ${tone}`}>
      <div className="bhead">
        <span className="ico" />
        <span className="ttl">{title}</span>
      </div>
      {count != null && <div className="bcount">{count}</div>}
      {items.map((it, i) => {
        const subs = it.subtasks ?? []
        const doneCount = subs.filter((s) => subtaskStatus(s.status).done).length
        return (
          <div className="item" key={i}>
            <b>
              {it.title}
              {it.weight != null && <span className="wt">{it.weight}%</span>}
              {subs.length > 0 && <span className="subroll">{doneCount}/{subs.length} done</span>}
            </b>
            {it.detail ? ` ${it.detail}` : ''}
            {subs.length > 0 && (
              <ul className="subtasks">
                {subs.map((s, j) => (
                  <li className="subtask" key={j}>
                    <span
                      className={`sdot ${subtaskStatus(s.status).tone}`}
                      role="img"
                      aria-label={s.status ? s.status : 'No status'}
                      title={s.status ? s.status : 'No status'}
                    />
                    {s.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
