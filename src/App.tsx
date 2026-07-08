import { useEffect, useState } from 'react'
import type { ReadinessPayload } from '../shared/readiness'
import { fetchReadiness } from './api'
import { Masthead } from './components/Masthead'
import { Tabs } from './components/Tabs'
import type { TabItem } from './components/Tabs'
import { DeliveryPanel } from './components/DeliveryPanel'
import { AnalyzersOverview } from './components/AnalyzersOverview'
import { partitionModules, globalAnalyzerPercent } from './lib/analyzers'

const ANALYZERS_SECTION = 'analyzers'
const OVERVIEW = 'overview'

export default function App() {
  const [payload, setPayload] = useState<ReadinessPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [activeAnalyzer, setActiveAnalyzer] = useState<string>(OVERVIEW)

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadiness(ctrl.signal)
      .then((p) => {
        setPayload(p)
        setActiveSection(p.modules[0]?.key ?? null)
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setError(e.message)
      })
    return () => ctrl.abort()
  }, [])

  if (error) {
    return <div className="wrap"><div className="card">Could not load the console: {error}</div></div>
  }
  if (!payload || !activeSection) {
    return <div className="wrap"><div className="card">Loading…</div></div>
  }

  const { delivery, analyzers } = partitionModules(payload.modules)
  const topItems: TabItem[] = [
    ...delivery.map((m) => ({ key: m.key, name: m.name, percent: m.percent })),
    { key: ANALYZERS_SECTION, name: 'Analyzers', percent: globalAnalyzerPercent(analyzers) },
  ]
  const subItems: TabItem[] = [
    { key: OVERVIEW, name: 'Overview' },
    ...analyzers.map((m) => ({ key: m.key, name: m.name, percent: m.percent })),
  ]
  const deliveryActive = delivery.find((m) => m.key === activeSection)
  const analyzerActive = analyzers.find((m) => m.key === activeAnalyzer)

  return (
    <div className="wrap">
      <Masthead asOf={payload.asOf} />
      <Tabs items={topItems} activeKey={activeSection} onSelect={setActiveSection} />
      {activeSection === ANALYZERS_SECTION ? (
        <>
          <div className="subnav">
            <Tabs items={subItems} activeKey={activeAnalyzer} onSelect={setActiveAnalyzer} />
          </div>
          {activeAnalyzer !== OVERVIEW && analyzerActive ? (
            <DeliveryPanel module={analyzerActive} />
          ) : (
            <AnalyzersOverview analyzers={analyzers} onSelect={setActiveAnalyzer} />
          )}
        </>
      ) : deliveryActive ? (
        <DeliveryPanel module={deliveryActive} />
      ) : null}
    </div>
  )
}
