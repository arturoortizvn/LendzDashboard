import type { ReactNode } from 'react'
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedOut>
        <div className="wrap">
          <div className="card">
            <SignIn />
          </div>
        </div>
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  )
}
