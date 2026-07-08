import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AnalyzersOverview } from './AnalyzersOverview'
import type { Module } from '../../shared/readiness'

const analyzers = [
  { key: 'bank', name: 'Bank Statement Analyzer', percent: 67, status: 'on_track', statusLabel: 'On track', accentColor: '#123456', counts: { delivered: 2, inProgress: 0, remaining: 1 } },
  { key: 'id', name: 'ID Analyzer', percent: 0, status: 'early', statusLabel: 'Early build', counts: { delivered: 0, inProgress: 1, remaining: 2 } },
] as unknown as Module[]

test('shows the story-weighted global percent and a card per analyzer', () => {
  render(<AnalyzersOverview analyzers={analyzers} onSelect={() => {}} />)
  expect(screen.getByText('Analyzer readiness')).toBeInTheDocument()
  expect(screen.getByText('33')).toBeInTheDocument() // 2 / 6
  expect(screen.getByText('Bank Statement Analyzer')).toBeInTheDocument()
  expect(screen.getByText('ID Analyzer')).toBeInTheDocument()
})

test('clicking a card selects that analyzer', async () => {
  const onSelect = vi.fn()
  render(<AnalyzersOverview analyzers={analyzers} onSelect={onSelect} />)
  await userEvent.click(screen.getByText('ID Analyzer'))
  expect(onSelect).toHaveBeenCalledWith('id')
})
