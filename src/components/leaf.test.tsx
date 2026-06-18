import { render, screen } from '@testing-library/react'
import { AssumedBadge } from './AssumedBadge'
import { ProgressBar } from './ProgressBar'
import { InfoTooltip } from './InfoTooltip'

test('AssumedBadge renders its text', () => {
  render(<AssumedBadge text="Architecture phase" />)
  expect(screen.getByText('Architecture phase')).toBeInTheDocument()
})

test('ProgressBar exposes the percent via aria', () => {
  render(<ProgressBar percent={71} />)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '71')
})

test('InfoTooltip renders its tip content', () => {
  render(<InfoTooltip>Helpful note</InfoTooltip>)
  expect(screen.getByText('Helpful note')).toBeInTheDocument()
})
