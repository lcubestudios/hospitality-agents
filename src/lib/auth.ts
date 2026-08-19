import { getSession } from './session'

export const DEV_USER_ID = '11111111-1111-1111-1111-111111111111'

export class UnauthorizedError extends Error {
  constructor() {
    super('Not signed in')
    this.name = 'UnauthorizedError'
  }
}

export async function getCurrentUserId(): Promise<string> {
  const session = await getSession()
  if (session?.userId) return session.userId

  // Never mask a missing/dropped session as the shared dev user in production —
  // that silently misattributes real requests to a fake identity instead of failing loudly.
  if (process.env.NODE_ENV !== 'production') return DEV_USER_ID

  throw new UnauthorizedError()
}
