import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const { image_url: photoUrl } = await req.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const supabase = await getAuthedSupabaseAdmin()

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('brand_id, post_topic')
      .eq('id', campaignId)
      .single()

    const { data: brand } = campaign
      ? await supabase
          .from('brands')
          .select('name, description, brand_voice')
          .eq('id', campaign.brand_id)
          .single()
      : { data: null }

    const brandName = brand?.name ?? 'our brand'
    const brandDesc = brand?.description ?? ''
    const brandVoice = brand?.brand_voice ?? ''
    const postTopic = campaign?.post_topic ?? 'a social media post'

    // Analyze uploaded photo for product context (optional)
    let productDetails = ''
    if (photoUrl) {
      try {
        const imgRes = await fetch(photoUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          const base64Image = Buffer.from(imgBuffer).toString('base64')

          const visionRes = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: 'image/jpeg',
                      data: base64Image,
                    },
                  },
                  {
                    type: 'text',
                    text: 'Describe this product photo in detail. Focus on: what the product is, colors, textures, visible details, plating, garnishes, condition (fresh/cooked/prepared state). Be specific and vivid.',
                  },
                ],
              },
            ],
          })

          productDetails = visionRes.content?.[0]?.type === 'text' ? visionRes.content[0].text : ''
        }
      } catch (err) {
        console.warn('Photo analysis for caption failed, proceeding without:', err)
      }
    }

    const systemPrompt = [
      'You write Instagram captions for food and beverage brands. You match the brand voice exactly and write captions that feel authentic, not corporate.',
      '',
      `Brand: ${brandName}`,
      `Description: ${brandDesc}`,
      `Brand voice: ${brandVoice}`,
      '',
      'Rules:',
      '- Caption should be 3-5 sentences max',
      '- Sound human, not like a press release',
      '- End with a subtle call to action if it fits naturally',
      '- Return ONLY valid JSON in this exact shape: { "caption": "...", "hashtags": ["...", "..."] }',
      '- Include 10-15 relevant hashtags',
      '- No markdown, no explanation, just the JSON',
    ].join('\n')

    const userMessage = [
      `Write an Instagram caption for this post: ${postTopic}`,
      productDetails ? `\nProduct details: ${productDetails}` : '',
    ]
      .filter(Boolean)
      .join('')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const text = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(text)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Caption generation error:', err)
    return NextResponse.json({ message: 'Caption generation failed' }, { status: 500 })
  }
}
