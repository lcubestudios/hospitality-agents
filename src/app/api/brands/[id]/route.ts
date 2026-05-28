import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { getCurrentUserId } from '@/lib/auth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const [supabase, userId] = await Promise.all([getAuthedSupabaseAdmin(), getCurrentUserId()])

    const { data, error } = await supabase
      .from('brands')
      .select(
        'id, name, description, brand_voice, business_type, food_drink_type, location, atmosphere, personality',
      )
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return NextResponse.json({ message: 'Brand not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Brand fetch error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const {
      name,
      description,
      brand_voice,
      business_type,
      food_drink_type,
      location,
      atmosphere,
      personality,
    } = await req.json()

    if (name !== undefined && (!name || name.trim() === '')) {
      return NextResponse.json({ message: 'Brand name cannot be empty' }, { status: 400 })
    }

    const [supabase, userId] = await Promise.all([getAuthedSupabaseAdmin(), getCurrentUserId()])

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    if (brand_voice !== undefined) updateData.brand_voice = brand_voice || null
    if (business_type !== undefined) updateData.business_type = business_type || null
    if (food_drink_type !== undefined) updateData.food_drink_type = food_drink_type || null
    if (location !== undefined) updateData.location = location || null
    if (atmosphere !== undefined) updateData.atmosphere = atmosphere?.length ? atmosphere : null
    if (personality !== undefined) updateData.personality = personality?.length ? personality : null

    const { data, error } = await supabase
      .from('brands')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Brand update error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await params
    const [supabase, userId] = await Promise.all([getAuthedSupabaseAdmin(), getCurrentUserId()])

    const { error: brandError } = await supabase.from('brands').delete().eq('user_id', userId)

    if (brandError) {
      return NextResponse.json({ message: brandError.message }, { status: 400 })
    }

    const { error: userError } = await supabase.from('users').delete().eq('id', userId)

    if (userError) {
      return NextResponse.json({ message: userError.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Account deleted successfully' })
  } catch (err) {
    console.error('Account delete error:', err)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
