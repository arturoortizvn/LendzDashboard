import type { BucketItem } from '../../shared/readiness'

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
      {count && <div className="bcount">{count}</div>}
      {items.map((it, i) => (
        <div className="item" key={i}>
          <b>
            {it.title}
            {it.weight != null && <span className="wt">{it.weight}%</span>}
          </b>
          {it.detail ? ` ${it.detail}` : ''}
        </div>
      ))}
    </div>
  )
}
