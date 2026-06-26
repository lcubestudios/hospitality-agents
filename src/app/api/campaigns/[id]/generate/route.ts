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
  return `You are the creative direction team for a trendy F&B brand's Instagram campaign. Your job: 4 distinct, visually STRIKING shot directions that stop the scroll. Think CreativebyKera — bold, designed, intentional.

Study the food. Describe it with precision: exact textures, colors, details. This is the hero that carries through all 4 shots.

NOW — think CREATIVE DIRECTION, not just "good food photos."

Each shot is a DESIGNED MOMENT. Think:
- Cheese pull, smoke, steam, action
- Ingredients floating, arranged, scattered artfully
- Pastel or boldly designed backgrounds
- Dynamic angles, crop into details, close-ups
- Hands interacting naturally but dramatically
- Props with PURPOSE — they design the frame
- Color as design tool, not accident
- Composition that's BOLD — not safe

4 distinct ideas. Each should be visually distinct. Each should feel like a designer/creative director made it, not just "put food on a plate."

VISUAL DIRECTION:

Light: Modern food photography lighting. Can be natural, can be designed. The light should ENHANCE drama and showcase the food.

Environment: Designed backgrounds — pastel, color-blocked, textured, or real spaces with strong character. Think trendy food content. Not generic white plate on white table.

Composition: Dynamic and intentional. Can be tight crops, extreme angles, overhead, close detail shots. Architectural when it works; bold and unconventional when it pops.

Color: Rich, designed, intentional. Not muted. The palette should support the brand and the food. Saturation is OK if it's purposeful.

Props: Selective. When something is in frame, it's because it tells the story or enhances the design. Ingredients, utensils, garnishes, styled elements.

Food Styling: Creative moments. Not just "here is the food." Think:
- A cheese pull mid-stretch
- Sauce dripping, pooling, running
- A bite taken, showing texture inside
- Ingredients scattered, arranged
- Steam or smoke visible
- A hand holding, dipping, breaking, tasting
- Close detail that shows quality

Human presence: Real and intentional. Hands when they add drama or story. Use them to show scale, action, interaction.

Zero text: No labels, signs, packaging text. If it's there in real life, face it away or exclude it.

Brand: ${brandName || 'not specified'}
Brand voice: ${brandVoice || 'not specified'}
${brandProfile ? brandProfile + '\n' : ''}Campaign topic: ${postTopic || 'not specified'}
${angleOrStory ? `Angle or story: ${angleOrStory}\n` : ''}${audience ? `Target audience: ${audience}\n` : ''}

These are for a trendy, designed food brand. Go bold. Go creative. Each shot should feel like a creative director designed it.

Return ONLY valid JSON:

{
  "subject_description": "exact visual description of the food — what makes THIS specific item distinct. Crust char, sauce state, cheese melt, color, garnish, cut, texture. Precise enough to reproduce.",
  "shots": [
    {
      "shot_label": "2–4 word name",
      "concept": "the CREATIVE IDEA. What makes this shot stop the scroll? What's the design moment?",
      "food_styling": "SPECIFIC styling action. Cheese pull at 45°. Sauce running. Bite taken. Steam visible. Hand interacting. Be VISUAL and DRAMATIC.",
      "set": "the DESIGNED environment. Pastel background. Textured surface. Color-blocked. Arranged props with exact positions. Make it intentional.",
      "color_world": "design-forward palette. Rich, saturated if it works. Intentional color story.",
      "lighting": "modern food photography lighting. Can be natural, can be designed studio. What reveals and enhances the food?",
      "camera": "angle and crop that works for THIS shot. Can be tight detail, extreme angle, overhead. Whatever serves the design.",
      "human_presence": "none | hands | implied"
    }
  ]
}

- shots: exactly 4, each DISTINCT and VISUALLY STRIKING
- subject_description: factual, precise
- human_presence: exactly one of "none", "hands", "implied"

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
Professional campaign-ready photograph for ${brandName || 'this brand'}. Shot with precision: perfect focus, rich natural colours, tactile textures, depth. Feels shot by a professional food photographer who knows this brand's story. Every detail is intentional. This is published work, not a quick snap.

[VISUAL STYLE — APPLY TO EVERY PIXEL]
THIS MUST STOP THE SCROLL. Professional food photography that makes people want this food.
Soft natural light only — window light, overcast, or practitioner light that feels like it belongs in the space. Never flash, never ring light, never artificial. Light should reveal texture and bring food to life.
Real environments with material character — concrete, aged timber, marble, ceramic, linen, stone. Never seamless backdrops. The space should feel authentic and designed.
Warm-neutral editorial colour grading — rich, natural, cohesive. Not desaturated, not moody, not filtered. Feels like professional food photography.
Architectural composition — deliberate negative space, one unmistakable focal point, clean sightlines. Never busy, never cluttered.
Maximum two or three intentional props total — every element earns its place.

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
    const client = new Anthropic()
    let caption = ''
    let hashtags: string[] = []

    try {
      const subjectDesc = strategy?.subject_description || 'our latest product'
      const captionPrompt = `Write a 1-2 sentence Instagram caption for ${brandName}. Product: ${subjectDesc}. Keep it real and simple—no flowery language. Just make people want it.`

      const captionRes = await client.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 100,
        messages: [{ role: 'user', content: captionPrompt }],
      })

      caption = (captionRes.content[0] as { type: 'text'; text: string }).text.trim()

      // Generate hashtags - optimized for reach
      const hashtagPrompt = `Generate 8 hashtags for ${brandName}.
MUST include: ${brandName.toLowerCase().replace(/\s+/g, '')}, ${brand?.location?.toLowerCase().replace(/\s+/g, '') || 'local'}
Food type: ${brand?.food_drink_type || 'food'}
Then add: 1-2 ${brand?.food_drink_type || 'food'}-specific tags, then reach tags (foodstagram, instafood, foodporn, foodie, eatlocal, localfood).
Return only words (no #), comma-separated.`

      const hashtagRes = await client.messages.create({
        model: 'claude-opus-4-1',
        max_tokens: 100,
        messages: [{ role: 'user', content: hashtagPrompt }],
      })

      const hashtagText = (hashtagRes.content[0] as { type: 'text'; text: string }).text.trim()
      hashtags = hashtagText.split(',').map((tag) => tag.trim().replace(/^#+/, ''))
    } catch (err) {
      console.warn('Caption generation failed, using fallback:', err)
      caption = `Experience the taste of ${brandName}. 🍽️`
      hashtags = ['foodstagram', 'instafood', 'foodphoto']
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
