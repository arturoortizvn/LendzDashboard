import { useEffect, useState } from 'react'
import type { ReadinessPayload } from '../shared/readiness'
import { fetchReadiness } from './api'
import { Masthead } from './components/Masthead'
import { Tabs } from './components/Tabs'
import { DeliveryPanel } from './components/DeliveryPanel'

export default function App() {
  const [payload, setPayload] = useState<ReadinessPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadiness(ctrl.signal)
      .then((p) => {
        setPayload(p)
        setActiveKey(p.modules[0]?.key ?? null)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => ctrl.abort()
  }, [])

  if (error) {
    return <div className="wrap"><div className="card">Could not load the console: {error}</div></div>
  }
  if (!payload || !activeKey) {
    return <div className="wrap"><div className="card">Loading…</div></div>
  }

  const active = payload.modules.find((m) => m.key === activeKey)!
  return (
    <div className="wrap">
      <Masthead asOf={payload.asOf} />
      <Tabs modules={payload.modules} activeKey={activeKey} onSelect={setActiveKey} />
      <DeliveryPanel module={active} />
    </div>
  )
}
