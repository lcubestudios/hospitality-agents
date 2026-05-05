import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface CaptionImageContext {
  subject: string
  sensory_details: string
  atmosphere: string
  mood: string
  one_sentence_scene: string
}

function safeParseJson<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      try {
        return JSON.parse(match[0]) as T
      } catch {
        return null
      }
    }
    return null
  }
}

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

    // STEP 1: Vision analysis — evocative scene language for caption writing
    let imageContext: CaptionImageContext = {
      subject: '',
      sensory_details: '',
      atmosphere: '',
      mood: '',
      one_sentence_scene: '',
    }

    if (photoUrl) {
      try {
        const imgRes = await fetch(photoUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          const base64Image = Buffer.from(imgBuffer).toString('base64')
          const mimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'

          const visionRes = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: mimeType as
                        | 'image/jpeg'
                        | 'image/png'
                        | 'image/gif'
                        | 'image/webp',
                      data: base64Image,
                    },
                  },
                  {
                    type: 'text',
                    text: `Analyze the uploaded food or drink image and extract evocative scene language for Instagram caption writing.

Return ONLY valid JSON in this exact shape:

{
  "subject": "",
  "sensory_details": "",
  "atmosphere": "",
  "mood": "",
  "one_sentence_scene": ""
}

Rules:

subject: 1-3 word dish/drink label only (e.g. "tom yum soup", "iced matcha latte")

sensory_details: Describe tactile and visual details using evocative sensory language. Focus on texture, steam, oil sheen, translucence, char, garnish, condensation, highlights, surface irregularities. Evoke appetite and realism — avoid technical language.

atmosphere: Describe the visible environment and ambient setting faithfully. Preserve what is actually in the image. Do not invent restaurant context or scene elements not visible.

mood: Single editorial adjective or short phrase (e.g. "humid street-side lunch", "bright weekend brunch", "intimate evening meal").

one_sentence_scene: One evocative sentence a copywriter could use as a caption seed. Must feel grounded, human, and cinematic. Must remain faithful to the actual food, plating, and visible environment. Do not exaggerate or invent scene elements.

Do NOT: describe mechanically, invent additional dishes or props, output markdown, output explanation.

Output ONLY valid JSON.`,
                  },
                ],
              },
            ],
          })

          const raw = visionRes.content?.[0]?.type === 'text' ? visionRes.content[0].text : ''
          const parsed = safeParseJson<CaptionImageContext>(raw)
          if (parsed?.subject) imageContext = parsed
        }
      } catch (err) {
        console.warn('Photo analysis for caption failed, proceeding without:', err)
      }
    }

    // STEP 2: Caption generation
    const systemPrompt = [
      'You write Instagram captions for food and beverage brands. Your goal is to create captions that drive engagement and subtle action while feeling natural, human, and specific to the brand.',
      '',
      `Brand: ${brandName}`,
      `Description: ${brandDesc}`,
      `Voice directive: ${brandVoice}`,
      '',
      'Interpret the voice directive and apply it consistently across word choice, sentence structure, punctuation, tone, and attitude. Do not describe the voice. Embody it.',
      '',
      'Image context (if available):',
      `Subject: ${imageContext.subject}`,
      `Sensory details: ${imageContext.sensory_details}`,
      `Atmosphere: ${imageContext.atmosphere}`,
      `Mood: ${imageContext.mood}`,
      `Scene: ${imageContext.one_sentence_scene}`,
      '',
      'Context:',
      'Write the caption as a real moment, not just a product description. Balance product presence with atmosphere.',
      '',
      'Rules:',
      '- 2-3 sentences max, ideally under 250 characters',
      '- First sentence must hook immediately — assume the reader will not tap "more"',
      '- Write as if the brand is speaking to a real audience',
      '- Avoid aggressive promotion; persuasion should feel natural',
      '- Include a subtle CTA when appropriate; occasionally allow a slightly more direct CTA if it fits',
      '- Maintain consistent tone throughout',
      '- Avoid repeating phrasing or patterns across outputs',
      '- No emojis',
      '',
      'Natural language constraints:',
      '- Avoid overly polished phrasing',
      '- Slight irregularity and personality is encouraged',
      '- Vary sentence length and structure',
      '- Avoid overusing phrases like "don\'t miss out", "now available", "perfect for", unless they fit naturally',
      '',
      'Output format:',
      'Return ONLY valid JSON: { "caption": "...", "hashtags": ["...", "..."] }',
      '',
      'Hashtags:',
      '- 10-15 total',
      '- Mix of broad, niche, contextual, and brand tags',
      '- Avoid spammy or irrelevant tags',
      '- Avoid repeating the same set across generations',
    ].join('\n')

    const userMessage = `Write an Instagram caption for this post: ${postTopic}`

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
    const parsed = safeParseJson<{ caption: string; hashtags: string[] }>(raw)

    if (!parsed?.caption) {
      return NextResponse.json({ message: 'Caption generation failed' }, { status: 500 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Caption generation error:', err)
    return NextResponse.json({ message: 'Caption generation failed' }, { status: 500 })
  }
}
