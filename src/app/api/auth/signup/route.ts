import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { hashPassword } from '@/lib/password'
import { setSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const { brand_name, password } = await req.json()

    if (!brand_name || !password) {
      return NextResponse.json({ message: 'Brand name and password required' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 },
      )
    }

    const supabase = await getAuthedSupabaseAdmin()

    // Check if brand name already exists
    const { data: existingBrand } = await supabase
      .from('brands')
      .select('id')
      .eq('name', brand_name)
      .maybeSingle()

    if (existingBrand) {
      return NextResponse.json({ message: 'Brand name already taken' }, { status: 400 })
    }

    // Create user with hashed password
    const hashedPassword = hashPassword(password)
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        password_hash: hashedPassword,
      })
      .select('id')
      .single()

    if (userError || !newUser) {
      return NextResponse.json({ message: 'Failed to create user' }, { status: 500 })
    }

    // Create brand for this user
    const { data: newBrand, error: brandError } = await supabase
      .from('brands')
      .insert({
        user_id: newUser.id,
        name: brand_name,
      })
      .select('id')
      .single()

    if (brandError || !newBrand) {
      return NextResponse.json({ message: 'Failed to create brand' }, { status: 500 })
    }

    // Set session
    await setSession({
      userId: newUser.id,
      brandId: newBrand.id,
      brandName: brand_name,
    })

    return NextResponse.json({
      message: 'Signup successful',
      userId: newUser.id,
      brandId: newBrand.id,
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
