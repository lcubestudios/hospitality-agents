import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { getCurrentUserId } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, description, brand_voice } = await req.json()

    if (name !== undefined && (!name || name.trim() === '')) {
      return NextResponse.json({ message: 'Brand name cannot be empty' }, { status: 400 })
    }

    const [supabase, userId] = await Promise.all([getAuthedSupabaseAdmin(), getCurrentUserId()])

    const updateData: { name?: string; description?: null | string; brand_voice?: null | string } =
      {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description || null
    if (brand_voice !== undefined) updateData.brand_voice = brand_voice || null

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
