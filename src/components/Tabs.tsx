import type { Module } from '../../shared/readiness'

export function Tabs({ modules, activeKey, onSelect }: {
  modules: Module[]
  activeKey: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="tabs" role="tablist">
      {modules.map((m) => (
        <button
          key={m.key}
          className={`tab${m.key === activeKey ? ' active' : ''}`}
          role="tab"
          aria-selected={m.key === activeKey}
          onClick={() => onSelect(m.key)}
        >
          {m.name}
          <span className="mini">{m.percent}%</span>
        </button>
      ))}
    </div>
  )
}
