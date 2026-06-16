import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

export async function POST(req: NextRequest) {
  try {
    const { campaign_id: campaignId, post_topic: postTopic } = await req.json()

    if (!campaignId) {
      return NextResponse.json({ error: 'campaign_id required' }, { status: 400 })
    }

    const supabase = await getAuthedSupabaseAdmin()

    // Get campaign and brand context
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('brand_id')
      .eq('id', campaignId)
      .single()

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const { data: brand } = await supabase
      .from('brands')
      .select('name, brand_voice, business_type, food_drink_type, atmosphere, personality')
      .eq('id', campaign.brand_id)
      .single()

    // Generate a single contextual caption using Claude
    const client = new Anthropic()
    const prompt = `Generate a single, engaging Instagram caption for ${brand?.name || 'this brand'}'s quick marketing post about "${postTopic || 'featured content'}".

Brand context:
${brand?.business_type ? `- Venue: ${brand.business_type}` : ''}
${brand?.food_drink_type ? `- Specialty: ${brand.food_drink_type}` : ''}
${brand?.brand_voice ? `- Voice: ${brand.brand_voice}` : ''}
${brand?.atmosphere?.length ? `- Atmosphere: ${brand.atmosphere.join(', ')}` : ''}
${brand?.personality?.length ? `- Personality: ${brand.personality.join(', ')}` : ''}

Requirements:
- One to two sentences
- Authentic to their brand voice
- Inviting and on-brand
- No hashtags
- No emojis
- Ready to use as-is

Return ONLY the caption text, nothing else.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [{ role: 'user', content: prompt }],
    })

    const caption =
      response.content[0]?.type === 'text'
        ? response.content[0].text.trim()
        : 'Check out this great content from ' + (brand?.name || 'our brand')

    return NextResponse.json({ caption })
  } catch (error) {
    console.error('Caption generation error:', error)
    return NextResponse.json({ error: 'Failed to generate caption' }, { status: 500 })
  }
}
