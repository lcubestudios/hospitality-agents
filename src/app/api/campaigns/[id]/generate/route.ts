import { NextRequest, NextResponse } from 'next/server'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params

    const supabase = await getAuthedSupabaseAdmin()

    // Mark campaign as generating
    await supabase.from('campaigns').update({ status: 'generating' }).eq('id', campaignId)

    // Generate a marketing image via Pollinations (no API key needed)
    const prompt = encodeURIComponent(
      'Professional food and beverage product marketing photo, studio lighting, clean white background, high-end commercial photography',
    )
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&model=flux&nologo=true&seed=${Date.now()}`

    const imageRes = await fetch(pollinationsUrl)
    if (!imageRes.ok) {
      return NextResponse.json({ message: 'Image generation failed' }, { status: 500 })
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer())

    // Upload generated image to Supabase Storage
    const storagePath = `${campaignId}/enhanced.jpg`
    const { error: uploadError } = await supabase.storage
      .from('campaign-uploads')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ message: uploadError.message }, { status: 400 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('campaign-uploads')
      .getPublicUrl(storagePath)

    const enhancedImageUrl = publicUrlData.publicUrl

    // Save as asset
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({
        campaign_id: campaignId,
        asset_type: 'image',
        asset_url: enhancedImageUrl,
      })
      .select()
      .single()

    if (assetError) {
      return NextResponse.json({ message: assetError.message }, { status: 400 })
    }

    // Mark campaign as completed
    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)

    return NextResponse.json({ asset_url: enhancedImageUrl, asset })
  } catch (err) {
    console.error('Generation error:', err)
    return NextResponse.json({ message: 'Generation failed' }, { status: 500 })
  }
}
