import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { getSession } from '@/lib/session'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const supabase = await getAuthedSupabaseAdmin()
  const { data, error } = await supabase
    .from('archives')
    .select('*')
    .eq('brand_id', session.brandId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ message: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { name, description, image_url, video_url, caption, hashtags } = await req.json()

  if (!name?.trim()) {
    return NextResponse.json({ message: 'Name is required' }, { status: 400 })
  }

  const supabase = await getAuthedSupabaseAdmin()

  // Check archive count limit
  const { count, error: countError } = await supabase
    .from('archives')
    .select('*', { count: 'exact', head: true })
    .eq('brand_id', session.brandId)

  if (countError) return NextResponse.json({ message: countError.message }, { status: 500 })
  if (count && count >= 5) {
    return NextResponse.json(
      { message: 'Maximum 5 archives allowed. Delete one to save another.' },
      { status: 409 },
    )
  }

  const { data, error } = await supabase
    .from('archives')
    .insert({
      brand_id: session.brandId,
      name: name.trim(),
      description: description?.trim() || null,
      image_url: image_url || null,
      video_url: video_url || null,
      caption: caption || null,
      hashtags: hashtags || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ message: error.message }, { status: 400 })
  return NextResponse.json(data)
}
