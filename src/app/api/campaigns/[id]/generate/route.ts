import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { sanitizeArrayForPrompt } from '@/lib/prompts/sanitizeArrayForPrompt'

export const maxDuration = 300

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

// ─── Claude campaign strategy types ──────────────────────────────────────────

interface ShotDirection {
  shot_label: string
  concept: string
  food_styling: string
  set: string
  color_world: string
  lighting: string
  camera: string
  human_presence: 'none' | 'hands' | 'implied'
}

export interface CampaignStrategy {
  subject_description: string
  shots: ShotDirection[]
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// ─── Step 1: Claude strategy prompt ──────────────────────────────────────────

function buildStrategyPrompt({
  brandName,
  brandVoice,
  brandProfile,
  postTopic,
  angleOrStory,
  audience,
}: {
  brandName: string
  brandVoice: string
  brandProfile: string
  postTopic: string
  angleOrStory: string
  audience: string
}): string {
  return `You are the entire creative production team for an F&B brand's Instagram content. You've been handed a photo of their food or drink and a brand brief. Your job is to conceive 4 distinct shot directions.

You are simultaneously:
- The brand strategist who understands what this brand needs to communicate
- The creative director who develops the concept for each shot
- The art director who defines the color world and visual tone
- The food stylist who decides exactly how the food is presented and treated
- The set designer who builds the environment — every element in frame is intentional
- The lighting director who designs the light setup
- The photographer who frames and shoots it
- The social strategist who knows what stops a scroll

Study the uploaded photo carefully. Before anything else, describe the food with precision — not just what type of dish it is, but what makes this specific one visually distinct. The exact crust char pattern, the way the sauce is distributed, the melt state of the cheese, the particular cut or fold, the colour of the glaze, the specific garnish placement. These details are what separate this pizza from every other pizza, this cocktail from every other cocktail. They must survive into every shot.

Then read the brand. Now develop 4 distinct creative directions. Each one is its own strong idea. They don't need to match — they just each need to be something you'd stop and look at on Instagram.

Think space first, food second. Design the world — the environment, the surface, the light, the atmosphere — then place the food into it. The food is the hero but it lives inside a world that was designed before it arrived. That's the difference between editorial and generic. Think architecturally: what is the space, what does light do in it, where exactly does the food sit, what else is in frame and where precisely.

For food styling: describe a still moment, not an action. Not "cheese pull" — "a single slice lifted at 45°, cheese beginning to stretch." Not "hands grabbing" — "one hand cradling the base from below, thumb resting along the crust." Specific enough to photograph.

For the set: every prop gets an exact position. Not "condiments nearby" — "a small ceramic dish of chili oil at 8 o'clock, 12cm from the edge, falling soft." If you can't place it, cut it.

VISUAL STYLE — this is non-negotiable creative direction for every shot:

Light: Soft, natural or naturalistic only. Window light, overcast daylight, or warm practitioner light designed to feel like it belongs in the space. No harsh shadows, no visible flash, no ring light, no artificial warmth from panels. Light has direction but is never hard or dramatic.

Environment: Real spaces with material character — concrete, aged timber, marble, ceramic tile, linen, brushed stone, plaster walls. Never a seamless studio backdrop. The room has texture. The surface has history. The food belongs there.

Composition: Architectural. Deliberate negative space. One unmistakable focal point. Clean sightlines. Portrait/vertical always. Never cluttered, never busy, never more than two or three intentional elements total.

Color: Warm-neutral editorial. Natural tones, not saturated. The entire frame has one cohesive color story — not random warmth, not high contrast, not moody for its own sake. The grade feels like good natural light, not a filter.

Props: Maximum restraint. One, maybe two supporting elements, each with an exact position. If a prop doesn't add to the story, it's not there. No generic restaurant props, no filler.

Human presence: Real and incidental. When hands appear they belong to someone in a genuine moment — not posed, not manicured, not stock. The food is being held or touched the way a person actually would.

Zero text in frame: No bottle labels, no packaging text, no chalkboards, no menu boards, no signage, no stamps, no printed matter of any kind. If something in the set would have text on it in real life — face it away, crop it out, or don't include it.

Brand: ${brandName || 'not specified'}
Brand voice: ${brandVoice || 'not specified'}
${brandProfile ? brandProfile + '\n' : ''}Campaign topic: ${postTopic || 'not specified'}
${angleOrStory ? `Angle or story: ${angleOrStory}\n` : ''}${audience ? `Target audience: ${audience}\n` : ''}
Every element you put in the set must earn its place. Nothing accidental, nothing generic. No crumpled napkins, no random clutter, no lazy props. If it's in frame, it's a decision.

Return ONLY valid JSON:

{
  "subject_description": "highly specific visual description of this exact food — not just what type of dish it is, but what makes this particular one distinct. Crust char pattern, sauce distribution, melt state, specific colours, garnish placement, cut or fold, glaze finish, any unique visual detail. The kind of description that would let someone reproduce this exact dish.",
  "shots": [
    {
      "shot_label": "2–4 word name",
      "concept": "the creative idea — what this shot makes you feel or want, and why it works for this brand",
      "food_styling": "exactly how the food is presented — state, treatment, styling action (whole, pulled apart, cross-sectioned, sauce running, held, etc.)",
      "set": "every intentional element in frame — surface, background, props. If it's not here, it's not in the shot.",
      "color_world": "the palette and tone — be specific (e.g. warm terracotta and cream, deep jewel tones, soft blush and white, high-contrast monochrome)",
      "lighting": "the full setup — direction, temperature, quality, what it does to the subject and the mood",
      "camera": "angle, distance, depth of field — always portrait/vertical orientation",
      "human_presence": "none | hands | implied"
    }
  ]
}

- shots: exactly 4.
- subject_description: factual only. What you see.
- human_presence: exactly one of "none", "hands", "implied".

Output ONLY valid JSON. No markdown. No explanation.`.trim()
}

// ─── Step 2: Per-shot Gemini image prompt ─────────────────────────────────────

function buildImagePrompt(
  shot: ShotDirection,
  subjectDescription: string,
  brandName: string,
): string {
  const humanPresenceBlock =
    shot.human_presence === 'hands'
      ? 'Hands in frame — a real person is holding, reaching for, or handling the food naturally. Hands look lived-in and real, not manicured or stock-photo perfect. No faces, no full figures.'
      : shot.human_presence === 'implied'
        ? 'Human presence implied only — a utensil resting mid-use, a portion already taken, a napkin pushed aside. No hands, no people visible. The evidence of someone is the story.'
        : 'No hands, no people. The food and its environment are the entire frame.'

  return `[SUBJECT — NON-NEGOTIABLE]
The uploaded photo shows the exact food subject you are photographing. Study it.

These are the specific visual characteristics of this food: ${subjectDescription}

Every one of these details must appear in your image. Do not substitute, generalise, or approximate. Do not make this food look like a generic version of itself. The subject described above is exactly what you are rendering — not a generic stand-in, not a different form of the same food type. The composition, angle, and setting change. The food does not.

Do NOT reproduce the composition, framing, crop, or setting of the reference photo. Build an entirely new image per this brief. Only the food itself carries over.

[SHOT: ${shot.shot_label}]
Concept: ${shot.concept}

[FOOD STYLING]
${shot.food_styling}

[SET]
${shot.set}

[COLOR]
${shot.color_world}

[LIGHT]
${shot.lighting}

[CAMERA]
${shot.camera}
Portrait/vertical orientation — 9:16, built for Instagram.

[PEOPLE]
${humanPresenceBlock}

[RENDER QUALITY]
Photograph-quality render for ${brandName || 'this brand'}. Natural depth of field, true-to-life food colours, tactile textures. Feels shot by someone who understands this food and this brand.

[VISUAL STYLE — APPLY TO EVERY PIXEL]
Soft natural light only — window light, overcast, or practitioner light that feels like it belongs in the space. Never flash, never ring light, never artificial.
Real environments with material character — concrete, aged timber, marble, ceramic, linen, stone. Never a seamless studio backdrop.
Warm-neutral editorial colour — natural, cohesive, not saturated, not moody for its own sake.
Architectural composition — deliberate negative space, one focal point, clean. Never cluttered.
Maximum two or three intentional elements in frame total.

[ABSOLUTE HARD NO — ZERO TOLERANCE]
- Any text, letters, words, numbers anywhere in the image — no bottle labels, no packaging, no chalkboards, no signs, no stamps, nothing with legible characters. If an object would have text on it in real life, face it away or exclude it entirely.
- Watermarks, copyright marks, or stock photo artifacts of any kind
- Crumpled, folded, or used napkins or tissues
- Props not specified in the set brief — do not invent or add anything
- Busy or undesigned backgrounds
- Generic restaurant props (chalkboard menus, generic signage, stock table settings)
- Over-manicured or fake-looking hands — real and lived-in only
- Stock photo aesthetic — artificial perfection, CGI sheen
- Warped or distorted food geometry
- Artificial glow, neon, lens flare, or HDR
- Surreal or non-photorealistic elements
- Multiple competing focal points`.trim()
}

// ─── Gemini API call ──────────────────────────────────────────────────────────

async function generateImageWithGemini(
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<Buffer | null> {
  const res = await fetch(
    `${BASE_URL}/models/gemini-3.1-flash-image:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              ...(imageBase64 ? [{ inline_data: { mime_type: mimeType, data: imageBase64 } }] : []),
            ],
          },
        ],
        generationConfig: { response_modalities: ['IMAGE'] },
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    },
  )

  if (!res.ok) {
    const errText = await res.text()
    console.error(`Gemini generation error (${res.status}):`, errText)
    return null
  }

  const data = await res.json()

  if (!data.candidates?.[0]) {
    console.error('No candidates in Gemini response:', data)
    return null
  }

  const imagePart = data.candidates[0].content?.parts?.find(
    (part: { inlineData?: { mimeType?: string; data?: string } }) =>
      part.inlineData?.mimeType?.startsWith('image/'),
  )

  if (!imagePart?.inlineData?.data) {
    console.error(
      'No image data in Gemini response. Prompt may have been blocked by safety filters.',
    )
    return null
  }

  return Buffer.from(imagePart.inlineData.data, 'base64')
}

// ─── Request interface ────────────────────────────────────────────────────────

interface GenerationRequest {
  image_url?: string
  post_topic?: string
  angle_or_story?: string
  audience?: string
  campaign_mode?: 'social' | 'ads'
  campaign_theme?: string
  start_date?: string
  end_date?: string
  posting_frequency?: string
  brand_voice_override?: string
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const body: GenerationRequest = await req.json()
    const {
      image_url: uploadedImageUrl,
      post_topic: directivePostTopic,
      angle_or_story: directiveAngleOrStory,
      audience: directiveAudience,
      brand_voice_override,
    } = body

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ message: 'GOOGLE_AI_STUDIO_KEY not configured' }, { status: 500 })
    }

    const supabase = await getAuthedSupabaseAdmin()
    await supabase.from('campaigns').update({ status: 'generating' }).eq('id', campaignId)

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('brand_id, post_topic')
      .eq('id', campaignId)
      .single()

    const postTopic = directivePostTopic ?? campaign?.post_topic ?? ''

    const { data: brand } = campaign
      ? await supabase
          .from('brands')
          .select(
            'name, location, description, brand_voice, business_type, food_drink_type, atmosphere, personality',
          )
          .eq('id', campaign.brand_id)
          .single()
      : { data: null }

    const brandName = brand?.name ?? ''
    const brandVoice = brand?.brand_voice ?? ''

    const brandProfileLines = [
      brand?.business_type && `Venue type: ${brand.business_type}`,
      brand?.food_drink_type && `Food & drink focus: ${brand.food_drink_type}`,
      brand?.atmosphere?.length && `Atmosphere: ${sanitizeArrayForPrompt(brand.atmosphere, 5)}`,
      brand?.personality?.length && `Personality: ${sanitizeArrayForPrompt(brand.personality, 5)}`,
    ].filter(Boolean)
    const brandProfile = brandProfileLines.join('\n')

    // ── Fetch and encode uploaded image ────────────────────────────────────────
    let uploadedBase64 = ''
    let uploadedMimeType = 'image/jpeg'

    if (uploadedImageUrl) {
      try {
        const imgRes = await fetch(uploadedImageUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          uploadedBase64 = Buffer.from(imgBuffer).toString('base64')
          uploadedMimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
        }
      } catch (err) {
        console.warn('Failed to fetch uploaded image:', err)
      }
    }

    // ── STEP 1: Claude campaign strategy ──────────────────────────────────────
    let strategy: CampaignStrategy | null = null

    if (uploadedBase64) {
      try {
        const client = new Anthropic()
        const strategyRes = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: uploadedMimeType as
                      | 'image/jpeg'
                      | 'image/png'
                      | 'image/gif'
                      | 'image/webp',
                    data: uploadedBase64,
                  },
                },
                {
                  type: 'text',
                  text: buildStrategyPrompt({
                    brandName,
                    brandVoice,
                    brandProfile,
                    postTopic,
                    angleOrStory: directiveAngleOrStory || '',
                    audience: directiveAudience || 'general',
                  }),
                },
              ],
            },
          ],
        })

        const raw = strategyRes.content?.[0]?.type === 'text' ? strategyRes.content[0].text : ''
        const parsed = safeParseJson<CampaignStrategy>(raw)
        if (parsed?.subject_description && Array.isArray(parsed.shots) && parsed.shots.length > 0) {
          strategy = parsed
          console.log('Campaign strategy:', JSON.stringify(strategy, null, 2))
        } else {
          console.warn('Claude strategy response did not match expected shape, using fallback')
        }
      } catch (err) {
        console.warn('Claude strategy call failed, using fallback:', err)
      }
    }

    // ── Fallback strategy: 1 generic shot ─────────────────────────────────────
    if (!strategy) {
      const fallbackSubject = postTopic.trim() || 'food subject'
      strategy = {
        subject_description: fallbackSubject,
        shots: [
          {
            shot_label: 'Hero shot',
            concept:
              'The dish at its most honest and appealing — no concept, just the food doing the work.',
            food_styling: 'Natural presentation as-is, full dish visible',
            set: 'Worn oak surface, dark ambient background',
            color_world: 'Warm, earthy, natural tones',
            lighting:
              'Soft directional light from upper left, warm temperature, gentle shadow roll-off',
            camera:
              'Three-quarter overhead, mid-range, dish fills 70% of frame, portrait orientation',
            human_presence: 'none',
          },
        ],
      }
    }

    // Clamp to 4 shots maximum
    const shots = strategy!.shots.slice(0, 4)
    const subjectDescription = strategy!.subject_description

    // ── STEP 2 & 3: Build prompts and generate images in parallel ─────────────
    const imagePrompts = shots.map((shot) => buildImagePrompt(shot, subjectDescription, brandName))

    console.log(`Generating ${shots.length} images in parallel...`)
    const generatedBuffers = await Promise.all(
      imagePrompts.map((prompt, i) => {
        console.log(`Gemini prompt [shot ${i + 1}]:`, prompt.substring(0, 200) + '...')
        return generateImageWithGemini(prompt, uploadedBase64, uploadedMimeType)
      }),
    )

    // ── STEP 4: Upload successful images to Supabase Storage ──────────────────
    const assets: Array<{ asset_url: string; shot_label: string }> = []

    await Promise.all(
      generatedBuffers.map(async (buffer, i) => {
        if (!buffer) {
          console.warn(`Shot ${i + 1} generation failed, skipping`)
          return
        }

        const shot = shots[i]
        const storagePath = `${campaignId}/shot-${i + 1}.jpg`

        const { error: uploadError } = await supabase.storage
          .from('campaign-uploads')
          .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })

        if (uploadError) {
          console.error(`Storage upload error for shot ${i + 1}:`, uploadError.message)
          return
        }

        const { data: publicUrlData } = supabase.storage
          .from('campaign-uploads')
          .getPublicUrl(storagePath)

        const assetUrl = publicUrlData.publicUrl

        const { error: assetError } = await supabase
          .from('assets')
          .insert({ campaign_id: campaignId, asset_type: 'image', asset_url: assetUrl })
          .select()
          .single()

        if (assetError) {
          console.error(`Asset insert error for shot ${i + 1}:`, assetError.message)
          return
        }

        assets.push({ asset_url: assetUrl, shot_label: shot.shot_label })
      }),
    )

    if (assets.length === 0) {
      await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaignId)
      return NextResponse.json(
        {
          message:
            'Image generation blocked — try describing colors/shapes instead of product types',
        },
        { status: 500 },
      )
    }

    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)

    // Generate caption and hashtags with Claude
    console.log('🔑 API Key present?', !!process.env.ANTHROPIC_API_KEY)
    const client = new Anthropic()
    let caption = ''
    let hashtags: string[] = []

    try {
      const subjectDesc = strategy?.subject_description || 'our latest product'
      const brandVoiceToUse = brand_voice_override || brand?.brand_voice || 'not specified'

      const captionPrompt = `Write a compelling Instagram caption for ${brandName} (${brandVoiceToUse} voice).
Product: ${subjectDesc}
${postTopic ? `Angle: ${postTopic}` : ''}

2-3 sentences max. Authentic, specific, makes people want it. No hashtags.`

      console.log('📝 Caption prompt:', captionPrompt.substring(0, 100) + '...')
      const captionRes = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{ role: 'user', content: captionPrompt }],
      })
      console.log('✓ Caption response received')

      caption = (captionRes.content[0] as { type: 'text'; text: string }).text.trim()

      // Generate hashtags
      const hashtagPrompt = `Generate 8-10 hashtags for: ${subjectDesc}. Brand: ${brandName} in ${brand?.location || 'the area'}.
${postTopic ? `Context: ${postTopic}` : ''}

Return ONLY hashtag words (no #), comma-separated. Include brand name and location.`

      const hashtagRes = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{ role: 'user', content: hashtagPrompt }],
      })

      const hashtagText = (hashtagRes.content[0] as { type: 'text'; text: string }).text.trim()
      hashtags = hashtagText
        .split(',')
        .map((tag) => tag.trim().replace(/^#+/, '').toLowerCase())
        .filter((tag) => tag.length > 0)
        .slice(0, 10)
    } catch (err) {
      console.error('❌ CAPTION GENERATION FAILED')
      console.error('Error details:', err instanceof Error ? err.message : JSON.stringify(err))
      console.error('Full error:', err)
      caption = `Discover what makes ${brandName} special. Every detail crafted for an unforgettable experience.`
      hashtags = ['foodstagram', 'instafood', 'foodie', 'eeeeeats']
    }

    return NextResponse.json({
      image_url: assets[0]?.asset_url || null,
      images: assets.map((a) => a.asset_url),
      caption,
      hashtags,
      campaign_strategy: strategy,
    })
  } catch (err) {
    console.error('Generation error:', err)
    return NextResponse.json({ message: 'Generation failed' }, { status: 500 })
  }
}
