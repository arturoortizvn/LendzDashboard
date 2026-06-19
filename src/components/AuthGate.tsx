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
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 56px)' }}>
          <SignIn appearance={signInAppearance} />
        </div>
      </SignedOut>
      <SignedIn>{children}</SignedIn>
    </>
  )
}
