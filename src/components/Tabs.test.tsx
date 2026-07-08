import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Tabs } from './Tabs'
import type { TabItem } from './Tabs'

const items: TabItem[] = [
  { key: 'pe', name: 'Pricing & Eligibility', percent: 71 },
  { key: 'analyzers', name: 'Analyzers', percent: 39 },
]

test('renders one tab per item, shows percent, and reports clicks', async () => {
  const onSelect = vi.fn()
  render(<Tabs items={items} activeKey="pe" onSelect={onSelect} />)
  expect(screen.getAllByRole('tab')).toHaveLength(2)
  expect(screen.getByText('71%')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('tab', { name: /Analyzers/ }))
  expect(onSelect).toHaveBeenCalledWith('analyzers')
})

test('omits the percent badge for items without a percent', () => {
  render(<Tabs items={[{ key: 'overview', name: 'Overview' }]} activeKey="overview" onSelect={() => {}} />)
  expect(screen.queryByText(/%/)).not.toBeInTheDocument()
})
