import type { ReactNode } from 'react'
import { SignedIn, SignedOut, SignIn } from '@clerk/clerk-react'

// Brand palette mirrored from src/styles/app.css
const signInAppearance = {
  variables: {
    colorPrimary: '#1E6FE0',
    colorText: '#0B1F3A',
    colorTextSecondary: '#5A6B82',
  },
}

export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <SignedOut>
        <div className="wrap">
          <div className="card">
            <SignIn appearance={signInAppearance} />
          </div>
        </div>
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  )
}
