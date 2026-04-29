import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { getCurrentUserId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { brand_id, post_topic } = await req.json()

    if (!brand_id) {
      return NextResponse.json({ message: 'brand_id is required' }, { status: 400 })
    }

    const [supabase, userId] = await Promise.all([getAuthedSupabaseAdmin(), getCurrentUserId()])

    // Verify the brand belongs to this user
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brand_id)
      .eq('user_id', userId)
      .single()

    if (brandError || !brand) {
      return NextResponse.json({ message: 'Brand not found' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({ brand_id, post_topic: post_topic || null, status: 'draft' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
