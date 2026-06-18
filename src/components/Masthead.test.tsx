import { render, screen } from '@testing-library/react'
import { Masthead } from './Masthead'

test('renders the brand', () => {
  render(<Masthead asOf="2026-06-17T14:00:00Z" />)
  expect(screen.getByText('LendLogic')).toBeInTheDocument()
  expect(screen.getByText('Delivery Readiness Console')).toBeInTheDocument()
})
