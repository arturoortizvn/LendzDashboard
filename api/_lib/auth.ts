import { verifyToken } from '@clerk/backend'
import type { VercelRequest } from '@vercel/node'

export function getClerkSecret(): string {
  const s = process.env.CLERK_SECRET_KEY
  if (!s) throw new Error('CLERK_SECRET_KEY is not set')
  return s
}

type Claims = Awaited<ReturnType<typeof verifyToken>>

export async function verifyRequest(req: VercelRequest): Promise<Claims | null> {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  const secretKey = getClerkSecret()
  try {
    return await verifyToken(header.slice('Bearer '.length), { secretKey })
  } catch {
    return null
  }
}
