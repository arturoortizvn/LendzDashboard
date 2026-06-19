import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AuthGate } from './AuthGate'

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignIn: () => <div>Sign in to continue</div>,
}))

test('places SignIn in the signed-out slot and children in the signed-in slot', () => {
  render(
    <AuthGate>
      <div>Dashboard content</div>
    </AuthGate>,
  )
  expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
  expect(screen.getByText('Dashboard content')).toBeInTheDocument()
})
