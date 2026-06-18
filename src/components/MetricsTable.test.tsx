import { render, screen } from '@testing-library/react'
import { MetricsTable } from './MetricsTable'

test('renders rows including sentinel current values', () => {
  render(
    <MetricsTable
      metrics={[
        { capability: 'Reads statements correctly', weight: 30, current: '93.8%', target: '95%', status: 'at_target', statusLabel: 'At target' },
        { capability: 'Output the system trusts', weight: 20, current: 'Not emitted', target: '70%', status: 'blocked', statusLabel: 'Blocked' },
      ]}
    />,
  )
  expect(screen.getByText('Reads statements correctly')).toBeInTheDocument()
  expect(screen.getByText('Not emitted')).toBeInTheDocument()
  expect(screen.getByText('Blocked')).toBeInTheDocument()
})
