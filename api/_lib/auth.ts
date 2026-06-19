import { verifyToken } from '@clerk/backend'
import type { VercelRequest } from '@vercel/node'

export function getClerkSecret(): string {
  const s = process.env.CLERK_SECRET_KEY
  if (!s) throw new Error('CLERK_SECRET_KEY is not set')
  return s
}

// Restricts which frontend origins (token `azp`) the API trusts. Empty = disabled
// (acts as a feature flag toggled by CLERK_AUTHORIZED_PARTIES). The deployment's own
// origins are always allowed so a deploy can never lock out its own frontend.
export function getAuthorizedParties(): string[] {
  const configured = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (configured.length === 0) return []
  const deploymentOrigins = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]
    .filter(Boolean)
    .map((host) => `https://${host}`)
  return [...new Set([...configured, ...deploymentOrigins])]
}

type Claims = Awaited<ReturnType<typeof verifyToken>>

export async function verifyRequest(req: VercelRequest): Promise<Claims | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const secretKey = getClerkSecret()
  const authorizedParties = getAuthorizedParties()
  try {
    return await verifyToken(header.slice('Bearer '.length), {
      secretKey,
      ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
    })
  } catch {
    return null
  }
}
