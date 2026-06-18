import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'
import { buildPayload } from '../shared/readiness'

vi.mock('./api', () => ({
  fetchReadiness: vi.fn(() => Promise.resolve(buildPayload('2026-06-17T14:00:00Z'))),
}))

afterEach(() => vi.clearAllMocks())

test('renders the first module after load and switches tabs', async () => {
  render(<App />)
  // 2 = the active tab button plus the rendered panel's mtitle
  await waitFor(() => expect(screen.getAllByText('Pricing & Eligibility')).toHaveLength(2))
  await userEvent.click(screen.getByRole('tab', { name: /Bank Statement Analyzer/ }))
  expect(screen.getByText('Capabilities at standard')).toBeInTheDocument()
})

test('shows an error card when the fetch fails', async () => {
  const { fetchReadiness } = await import('./api')
  vi.mocked(fetchReadiness).mockRejectedValueOnce(new Error('boom'))
  render(<App />)
  await waitFor(() => expect(screen.getByText(/Could not load the console/)).toBeInTheDocument())
})
