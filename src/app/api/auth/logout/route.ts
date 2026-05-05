import { NextRequest, NextResponse } from 'next/server'
import { clearSession } from '@/lib/session'

export async function POST() {
  try {
    await clearSession()
    return NextResponse.json({ message: 'Logged out' })
  } catch (err) {
    console.error('Logout error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
