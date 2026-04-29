import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { getCurrentUserId } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name, description } = await req.json()

    if (!name || name.trim() === '') {
      return NextResponse.json({ message: 'Brand name is required' }, { status: 400 })
    }

    const [supabase, userId] = await Promise.all([getAuthedSupabaseAdmin(), getCurrentUserId()])

    const { data, error } = await supabase
      .from('brands')
      .update({ name, description: description || null })
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
