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

test('without a brief, shows the Target date block and no status line', () => {
  render(<DeliveryPanel module={m} />)
  expect(screen.getByText('Target')).toBeInTheDocument()
  expect(screen.getByText('11 July')).toBeInTheDocument()
  expect(screen.queryByText('Go / No-Go')).not.toBeInTheDocument()
})

const withBrief: DeliveryModule = {
  ...m,
  brief: {
    programStatus: 'on_track',
    programStatusLabel: 'On Track',
    statusLine: 'Engine complete. Minor fixes only.',
    goNoGo: 'Jul 20',
    goLive: 'Aug 1',
  },
}

test('with a brief, renders the editorial pill, status line, and date strip (not Target)', () => {
  render(<DeliveryPanel module={withBrief} />)
  expect(screen.getByText('On Track')).toBeInTheDocument()
  expect(screen.getByText('Engine complete. Minor fixes only.')).toBeInTheDocument()
  expect(screen.getByText('Go / No-Go')).toBeInTheDocument()
  expect(screen.getByText('Jul 20')).toBeInTheDocument()
  expect(screen.getByText('Go Live')).toBeInTheDocument()
  expect(screen.getByText('Aug 1')).toBeInTheDocument()
  expect(screen.queryByText('Target')).not.toBeInTheDocument()
  // the live computed pill still renders alongside the editorial one
  expect(screen.getByText('On track')).toBeInTheDocument()
})

const datesOnlyBrief: DeliveryModule = {
  ...m,
  brief: { goNoGo: 'Jul 27', goLive: 'Aug 1' },
}

test('a dates-only brief shows the date strip without an editorial pill or status line', () => {
  render(<DeliveryPanel module={datesOnlyBrief} />)
  expect(screen.getByText('Go / No-Go')).toBeInTheDocument()
  expect(screen.getByText('Jul 27')).toBeInTheDocument()
  expect(screen.getByText('Go Live')).toBeInTheDocument()
  expect(screen.queryByText('Target')).not.toBeInTheDocument()
  // no hand-written status line for a dates-only brief
  expect(screen.queryByText('Engine complete. Minor fixes only.')).not.toBeInTheDocument()
  // the computed status pill still renders in the progress card
  expect(screen.getByText('On track')).toBeInTheDocument()
})

const withDetail: DeliveryModule = {
  ...m,
  brief: {
    ...withBrief.brief!,
    goLive: 'Aug 1 (Phase 1)',
    detail: {
      phaseScope: ['Document Upload and Versioning'],
      analyzerStatus: [{ name: 'Bank Statement', note: 'extraction delivered' }],
    },
  },
}

test('with a detail, renders the expandable scope and analyzer status', () => {
  render(<DeliveryPanel module={withDetail} />)
  expect(screen.getByText('Phase 1 scope')).toBeInTheDocument()
  expect(screen.getByText('Document Upload and Versioning')).toBeInTheDocument()
  expect(screen.getByText('Analyzer status')).toBeInTheDocument()
  expect(screen.getByText('Bank Statement')).toBeInTheDocument()
  expect(screen.getByText(/extraction delivered/)).toBeInTheDocument()
})
