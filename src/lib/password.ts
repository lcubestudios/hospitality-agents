import crypto from 'crypto'

const SALT = process.env.PASSWORD_SALT || 'default-salt-change-in-env'

export function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 100000, 64, 'sha512').toString('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  const hashOfInput = hashPassword(password)
  return hashOfInput === hash
}
