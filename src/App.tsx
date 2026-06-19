import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import type { Module, ReadinessPayload } from '../shared/readiness'
import { fetchReadiness } from './api'
import { Masthead } from './components/Masthead'
import { Tabs } from './components/Tabs'
import { DeliveryPanel } from './components/DeliveryPanel'
import { MeasurementPanel } from './components/MeasurementPanel'

function renderPanel(m: Module) {
  return m.phase === 'measurement'
    ? <MeasurementPanel module={m} />
    : <DeliveryPanel module={m} />
}

export default function App() {
  const { getToken } = useAuth()
  const [payload, setPayload] = useState<ReadinessPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeKey, setActiveKey] = useState<string | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadiness(getToken, ctrl.signal)
      .then((p) => {
        setPayload(p)
        setActiveKey(p.modules[0]?.key ?? null)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => ctrl.abort()
  }, [getToken])

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
      {renderPanel(active)}
    </div>
  )
}
