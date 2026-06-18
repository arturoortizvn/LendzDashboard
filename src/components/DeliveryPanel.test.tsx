import { render, screen } from '@testing-library/react'
import { DeliveryPanel } from './DeliveryPanel'
import type { DeliveryModule } from '../../shared/readiness'

const m: DeliveryModule = {
  key: 'pe', name: 'Pricing & Eligibility', sub: 'Pricing engine.', phase: 'delivery',
  percent: 71, status: 'on_track', statusLabel: 'On track', note: '53 of 75 accepted.',
  targetDate: '11 July', dateConfidence: 'committed', assumed: false,
  counts: { delivered: 53, inProgress: 14, remaining: 8 },
  buckets: {
    delivered: [{ title: 'Product catalog' }],
    inProgress: [{ title: 'Final price calc' }],
    remaining: [{ title: 'Series 2 rules' }],
  },
}

test('renders module name, percent, and three buckets', () => {
  render(<DeliveryPanel module={m} />)
  expect(screen.getByText('Pricing & Eligibility')).toBeInTheDocument()
  expect(screen.getByText('71')).toBeInTheDocument()
  expect(screen.getByText('Delivered')).toBeInTheDocument()
  expect(screen.getByText('In Progress')).toBeInTheDocument()
  expect(screen.getAllByText('Remaining')).toHaveLength(2)
})
