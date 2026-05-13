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

sensory_details: Key tactile or visual details—texture, steam, char, plating. Keep brief.

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
    const imageContextJson = JSON.stringify({
      subject: imageContext.subject,
      sensory_details: imageContext.sensory_details,
      atmosphere: imageContext.atmosphere,
      mood: imageContext.mood,
      scene: imageContext.one_sentence_scene,
    })

    const systemPrompt = [
      'You write Instagram captions for food and beverage brands.',
      '',
      "PRIMARY DIRECTIVE: The user's input is the creative anchor. The final caption must remain recognizably rooted in it.",
      'Expand it. Refine it. Intensify it. Do not replace it with a new narrative.',
      "If the user's input is short, minimalist, or restrained — preserve that restraint. Do not over-explain or overwrite concise direction with additional storytelling.",
      "The caption should sound like a natural extension of the user's input, not a reinterpretation of it.",
      '',
      'Input priority order:',
      '1. User input — creative anchor, highest weight. Everything else serves this.',
      '2. Brand voice — shapes tone, word choice, attitude.',
      '3. Image sensory details — physical grounding only (texture, temperature, crunch, char, acidity, freshness).',
      '4. Atmosphere / mood — supporting context only, never the subject.',
      '5. CTA — optional, almost invisible.',
      '',
      `Brand: ${brandName}`,
      `Description: ${brandDesc}`,
      `Voice directive: ${brandVoice}`,
      '',
      'Interpret the voice directive and apply it consistently across word choice, sentence structure, punctuation, tone, and attitude. Do not describe the voice. Embody it.',
      '',
      "Image context (physical reference only — use to support the user's concept, not override it):",
      imageContextJson,
      '',
      'Caption structure — 2-3 sentences, anchored to ONE dominant sensory idea:',
      "1. Opener: rooted in the user's input. Add one physical sensation if it sharpens it — texture, temperature, crunch, char, acidity, glaze, steam, contrast. Stay close to the food.",
      '2. Craving line: why this is worth eating right now. Brand voice drives this. No historical commentary, no cultural narration.',
      '3. Closer (optional): a short, almost invisible CTA or attitude line. Must feel earned. Examples: "Worth eating slowly." / "Hard to stop at one bite." — never invented slogans or dramatic declarations.',
      '',
      'Hard constraints:',
      '- One dominant sensory idea per caption. Do not stack plating + setting + history + CTA.',
      '- The food is the subject. The environment only supports the craving.',
      '- No food journalism, cinematic narration, or article prose.',
      '- No invented brand slogans, philosophical statements, or dramatic declarations unless explicitly implied by the user input.',
      '- No historical commentary or cultural authority claims ("This is the dish that built...").',
      '- No invented brand history, founding dates, generational claims, or accolades unless in the brand description.',
      '- No generic openers ("Indulge in...", "Treat yourself...", "Introducing...").',
      '- No emojis.',
      '',
      'Length: 2-3 sentences, under 220 characters.',
      '',
      'Output format:',
      'Return ONLY valid JSON: { "caption": "...", "hashtags": [...] }',
      '',
      'Hashtags (10-12 total):',
      '- 2-3 brand-specific tags',
      '- 3-4 niche food/beverage category tags',
      '- 3-4 contextual to mood, occasion, or setting',
      '- 2 broad discovery tags',
      '- Avoid spammy or irrelevant tags',
      '- Vary hashtags when inputs (topic, image, mood) differ; identical inputs may produce identical tags',
    ].join('\n')

    const userMessage = `Creative direction: ${postTopic}\n\nWrite an Instagram caption rooted in this direction. Use brand voice and image context to support and intensify it — not replace it.`

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
