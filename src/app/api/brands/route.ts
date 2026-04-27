import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { getCurrentUserId } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { name, description } = await req.json()

    if (!name || name.trim() === '') {
      return NextResponse.json({ message: 'Brand name is required' }, { status: 400 })
    }

    const [supabase, userId] = await Promise.all([getAuthedSupabaseAdmin(), getCurrentUserId()])

    const { data, error } = await supabase
      .from('brands')
      .insert({ name, description: description || null, user_id: userId })
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

export async function GET() {
  try {
    const supabase = await getAuthedSupabaseAdmin()

    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
