import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { setSession } from '@/lib/session'
import { hashPassword } from '@/lib/password'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ message: 'Dev login not available in production' }, { status: 403 })
  }

  try {
    const { brand_name = 'Test Brand', password = 'test123' } = await req.json()

    const supabase = await getAuthedSupabaseAdmin()

    // Check if brand exists
    let brandId: string
    const { data: existingBrand } = await supabase
      .from('brands')
      .select('id, user_id')
      .eq('name', brand_name)
      .maybeSingle()

    if (existingBrand) {
      brandId = existingBrand.id
    } else {
      // Create test brand
      const { data: newBrand, error: brandError } = await supabase
        .from('brands')
        .insert([
          {
            name: brand_name,
            user_id: '11111111-1111-1111-1111-111111111111',
          },
        ])
        .select('id')
        .single()

      if (brandError || !newBrand) {
        return NextResponse.json(
          { message: 'Failed to create test brand', error: brandError },
          { status: 500 },
        )
      }
      brandId = newBrand.id
    }

    // Check if test user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('id', '11111111-1111-1111-1111-111111111111')
      .maybeSingle()

    if (!existingUser) {
      // Create test user
      const passwordHash = hashPassword(password)
      const { error: userError } = await supabase.from('users').insert([
        {
          id: '11111111-1111-1111-1111-111111111111',
          password_hash: passwordHash,
        },
      ])

      if (userError) {
        return NextResponse.json(
          { message: 'Failed to create test user', error: userError },
          { status: 500 },
        )
      }
    }

    // Update brand to link to user if needed
    const { data: checkBrand } = await supabase
      .from('brands')
      .select('user_id')
      .eq('id', brandId)
      .single()
    if (checkBrand?.user_id !== '11111111-1111-1111-1111-111111111111') {
      await supabase
        .from('brands')
        .update({ user_id: '11111111-1111-1111-1111-111111111111' })
        .eq('id', brandId)
    }

    // Set session
    await setSession({
      userId: '11111111-1111-1111-1111-111111111111',
      brandId,
      brandName: brand_name,
    })

    return NextResponse.json({
      message: 'Dev login successful',
      userId: '11111111-1111-1111-1111-111111111111',
      brandId,
      brandName: brand_name,
    })
  } catch (err) {
    console.error('Dev login error:', err)
    return NextResponse.json(
      { message: 'Internal server error', error: String(err) },
      { status: 500 },
    )
  }
}
