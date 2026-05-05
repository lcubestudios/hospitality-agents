import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { verifyPassword } from '@/lib/password'
import { setSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const { brand_name, password } = await req.json()

    if (!brand_name || !password) {
      return NextResponse.json({ message: 'Brand name and password required' }, { status: 400 })
    }

    const supabase = await getAuthedSupabaseAdmin()

    // Find user by brand name
    const { data: brand } = await supabase
      .from('brands')
      .select('id, user_id, name')
      .eq('name', brand_name)
      .maybeSingle()

    if (!brand) {
      return NextResponse.json({ message: 'Brand not found' }, { status: 401 })
    }

    // Get user and verify password
    const { data: user } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', brand.user_id)
      .maybeSingle()

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ message: 'Invalid password' }, { status: 401 })
    }

    // Set session
    await setSession({
      userId: user.id,
      brandId: brand.id,
      brandName: brand.name,
    })

    return NextResponse.json({
      message: 'Login successful',
      userId: user.id,
      brandId: brand.id,
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
