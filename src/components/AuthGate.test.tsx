import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AuthGate } from './AuthGate'

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: ReactNode }) => <div data-testid="signed-in">{children}</div>,
  SignedOut: ({ children }: { children: ReactNode }) => <div data-testid="signed-out">{children}</div>,
  SignIn: () => <div>Sign in to continue</div>,
}))

test('places SignIn in the signed-out slot and children in the signed-in slot', () => {
  render(
    <AuthGate>
      <div>Dashboard content</div>
    </AuthGate>,
  )
  expect(within(screen.getByTestId('signed-out')).getByText('Sign in to continue')).toBeInTheDocument()
  expect(within(screen.getByTestId('signed-in')).getByText('Dashboard content')).toBeInTheDocument()
})
