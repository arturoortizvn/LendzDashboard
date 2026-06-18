import { render, screen } from '@testing-library/react'
import { MeasurementPanel } from './MeasurementPanel'
import type { MeasurementModule } from '../../shared/readiness'

const bank: MeasurementModule = {
  key: 'bank', name: 'Bank Statement Analyzer', sub: 'Measurement.', phase: 'measurement',
  percent: 77, status: 'on_track', statusLabel: 'On track', note: 'Weighted.',
  targetDate: '~6 July', dateConfidence: 'projected',
  capabilitiesAtStandard: { count: 4, of: 6 },
  composite: { value: 77, denominator: 97, costExcluded: true },
  gapNote: '23 points from 100.',
  metrics: [
    { capability: 'Output the system trusts', weight: 20, current: 'Not emitted', target: '70%', status: 'blocked', statusLabel: 'Blocked' },
  ],
  buckets: { achieved: [], holding: [], mustComplete: [] },
}

test('renders composite, capability count, and the metrics table', () => {
  render(<MeasurementPanel module={bank} />)
  expect(screen.getByText('77')).toBeInTheDocument()
  expect(screen.getByText('4')).toBeInTheDocument()
  expect(screen.getByText('Not emitted')).toBeInTheDocument()
})
