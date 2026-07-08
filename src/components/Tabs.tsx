export interface TabItem {
  key: string
  name: string
  percent?: number
}

export function Tabs({ items, activeKey, onSelect }: {
  items: TabItem[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.key}
          className={`tab${it.key === activeKey ? ' active' : ''}`}
          role="tab"
          aria-selected={it.key === activeKey}
          onClick={() => onSelect(it.key)}
        >
          {it.name}
          {it.percent != null && <span className="mini">{it.percent}%</span>}
        </button>
      ))}
    </div>
  )
}
