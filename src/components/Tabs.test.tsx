import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { Tabs } from './Tabs'
import type { Module } from '../../shared/readiness'

const modules = [
  { key: 'pe', name: 'Pricing & Eligibility', percent: 71 },
  { key: 'bank', name: 'Bank Statement Analyzer', percent: 77 },
] as unknown as Module[]

test('renders one tab per module and reports clicks', async () => {
  const onSelect = vi.fn()
  render(<Tabs modules={modules} activeKey="pe" onSelect={onSelect} />)
  expect(screen.getAllByRole('tab')).toHaveLength(2)
  await userEvent.click(screen.getByRole('tab', { name: /Bank Statement Analyzer/ }))
  expect(onSelect).toHaveBeenCalledWith('bank')
})
