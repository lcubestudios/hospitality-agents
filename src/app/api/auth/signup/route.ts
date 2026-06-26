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

    const supabase = await getAuthedSupabaseAdmin()

    // Check if brand already exists
    const { data: existingBrand } = await supabase
      .from('brands')
      .select('id')
      .eq('name', brand_name)
      .maybeSingle()

    if (existingBrand) {
      return NextResponse.json({ message: 'Brand name already taken' }, { status: 409 })
    }

    // Create user
    const passwordHash = hashPassword(password)
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{ password_hash: passwordHash }])
      .select('id')
      .single()

    if (userError || !user) {
      return NextResponse.json({ message: 'Failed to create user' }, { status: 500 })
    }

    // Create brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert([
        {
          name: brand_name,
          user_id: user.id,
          business_type: '',
          food_drink_type: '',
          location: '',
          description: '',
          brand_voice: '',
          atmosphere: [],
          personality: [],
        },
      ])
      .select('id')
      .single()

    if (brandError || !brand) {
      return NextResponse.json({ message: 'Failed to create brand' }, { status: 500 })
    }

    // Set session
    await setSession({
      userId: user.id,
      brandId: brand.id,
      brandName: brand_name,
    })

    return NextResponse.json({
      message: 'Signup successful',
      userId: user.id,
      brandId: brand.id,
    })
  } catch (err) {
    console.error('Signup error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
