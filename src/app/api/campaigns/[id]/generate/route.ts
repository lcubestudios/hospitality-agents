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
  return `You are the creative direction team for ${brandName || 'this F&B brand'}. Your job: 4 distinct, visually STRIKING shot directions that feel like THIS BRAND. Not generic food content — content that belongs to this specific restaurant and no other.

BRAND IDENTITY (MUST INFORM EVERY DECISION):
${brandProfile ? brandProfile : 'Brand context: not specified'}
Brand voice: ${brandVoice || 'neutral'}

Study the food. Describe it with precision: exact textures, colors, details. This is the hero that carries through all 4 shots.

NOW — think BRAND IDENTITY. Every shot must feel like it belongs to ${brandName}.

Each shot is a BOLD, DESIGNED MOMENT that transforms the food into campaign-ready content while respecting this brand's identity. Think:
- Cheese pull caught mid-stretch at dramatic angle, smoke curling
- Ingredients elevated, scattered with intention, or arranged architecturally
- Backgrounds that match the brand's aesthetic AND read as intentional design — not casual, not snapshot
- Extreme angles, tight crops into textural detail, overhead geometry, close-ups that reveal
- Hands as compositional elements — holding, reaching, interacting with clear narrative
- Props as DESIGNED STATEMENTS — they don't just sit, they compose the frame
- Color palette that BELONGS to this brand but pushed for maximum visual impact
- Composition that feels like a creative director art-directed it — architectural, bold, not safe

4 visually DISTINCT ideas. Each a different creative concept. Each should feel like a professional food campaign shoot, not just "different angles of the dish."

CRITICAL DISTINCTION: The output must be OBVIOUSLY a campaign shoot:
- Styling that reads as intentional, not natural presentation
- Composition that shows design thinking — not just nice lighting
- Each shot has a clear visual concept that stops the scroll
- Props, arrangements, and details all feel chosen and purposeful

VISUAL COHERENCE AS A SET:
- All 4 share the brand's color foundation and material language
- BUT each shot is a completely different visual concept — different lighting approach, different compositional strategy, different styling moment
- Viewer sees all 4 and thinks: "This is clearly ${brandName}'s professional campaign. These are four DISTINCT creative directions for the same product."
- Not random shots. Not repetitive. A curated campaign.

VISUAL DIRECTION — GROUNDED IN BRAND:

Light: Modern food photography lighting that matches the brand's vibe. If ${brandName} is warm & intimate, use soft warm light. If modern & clean, use crisp directional light. The light should ENHANCE the brand's story and showcase the food.

Environment: Designed backgrounds that reflect the brand's personality and atmosphere. Not generic. NOT random pastels or trendy defaults. The set should feel like it belongs to ${brandName}'s world — their color palette, their materials, their design sensibility.

Composition: Dynamic and intentional. Can be tight crops, extreme angles, overhead, close detail shots. Architectural when it works; bold when it pops. But always cohesive with brand personality.

Color Palette: THIS IS CRITICAL. NOT a generic food photo palette. The color world should reflect the brand's identity, atmosphere, and personality traits listed above. Rich or minimal, warm or cool, saturated or natural — whatever fits ${brandName}. Saturation is OK if it matches the brand's aesthetic.

Props: Selective. When something is in frame, it reinforces the brand's story. Materials, finishes, and objects should feel at home in ${brandName}'s world.

Food Styling: Creative moments specific to this dish. Not just "here is the food." Think:
- A cheese pull mid-stretch
- Sauce dripping, pooling, running
- Ingredients scattered, arranged
- Steam or smoke visible
- A hand holding, dipping, interacting
- Close detail that shows quality
THE FOOD MUST BE WHOLE AND INTACT. Not bitten, not partial. Quantity matches input: one slice = one slice, one pizza = one pizza.

Human presence: Real and intentional. Hands when they add drama or story. Use them to show scale, action, interaction.

Zero text: No labels, signs, packaging text. If it's there in real life, face it away or exclude it.

Campaign topic: ${postTopic || 'not specified'}
${angleOrStory ? `Angle or story: ${angleOrStory}\n` : ''}${audience ? `Target audience: ${audience}\n` : ''}

Every shot must feel like it belongs to ${brandName}. This is not generic trendy food content. This is content that tells THIS brand's story.

Return ONLY valid JSON:

{
  "subject_description": "exact visual description of the food — what makes THIS specific item distinct. Crust char, sauce state, cheese melt, color, garnish, cut, texture. Precise enough to reproduce. CRITICAL: Describe the exact quantity shown in the input image. One slice = one slice. One pizza = one pizza. Do not add or remove items.",
  "shots": [
    {
      "shot_label": "2–4 word name",
      "concept": "the BOLD CREATIVE CAMPAIGN IDEA. What's the visual hook that stops the scroll? What's the designed moment? How does this reflect ${brandName}'s identity? Be specific about WHY this shot matters.",
      "food_styling": "SPECIFIC, INTENTIONAL styling action for a campaign shoot. Cheese pull at 45°. Sauce running mid-drip. Steam curling. Hand dramatically interacting. A detail magnified. Be VISUAL, DRAMATIC, and CLEAR about the action.",
      "set": "the DESIGNED environment that reflects ${brandName}'s aesthetic. Materials, colors, props — everything intentional and cohesive with the brand.",
      "color_world": "the color palette that belongs to ${brandName}. Not a generic food photo palette. Rich, minimal, warm, cool — whatever fits this brand's personality. Include specific color notes (warm terracottas, cool grays, bright citrus, deep earthy tones, etc.)",
      "lighting": "food photography lighting that matches ${brandName}'s vibe. Warm & intimate, or crisp & modern? Natural, designed studio, or something in between? What reveals the food AND the brand's personality?",
      "camera": "angle and crop that works for THIS shot AND this brand. Can be tight detail, extreme angle, overhead. Whatever serves both the design and the brand's visual language.",
      "human_presence": "none | hands | implied"
    }
  ]
}

- shots: exactly 4, each DISTINCT and VISUALLY STRIKING, and COHESIVE with each other
- subject_description: factual, precise
- human_presence: exactly one of "none", "hands", "implied"
- ALL DECISIONS MUST BE GROUNDED IN THE BRAND'S IDENTITY

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

  return `[BRAND & SUBJECT — NON-NEGOTIABLE]
You are creating content for ${brandName}. Every pixel must feel like it belongs to this brand.

The uploaded photo shows the exact food subject you are photographing. Study it.
These are the specific visual characteristics: ${subjectDescription}

Every one of these details must appear in your image. Do not substitute, generalise, or approximate. The subject described is exactly what you render — not a generic stand-in. The composition, angle, and setting change. The food does not.

Do NOT reproduce the reference photo's composition, framing, crop, or setting. Build an entirely new image per this brief. Only the food itself carries over.

[SHOT: ${shot.shot_label}]
Concept: ${shot.concept}

[FOOD STYLING]
${shot.food_styling}

[SET — BRAND COHERENCE CRITICAL]
${shot.set}

This environment must feel like it belongs to ${brandName}'s world. Not a generic food photo background. The materials, finishes, and spatial feel should all cohere with the brand's identity.

[COLOR PALETTE — BRAND ANCHORED]
${shot.color_world}

This is NOT a generic food photo palette. It is the visual language of ${brandName}. Every color choice must reinforce the brand's personality and atmosphere. Apply this palette throughout the entire image — backgrounds, props, lighting tones, and the food's interaction with light.

[LIGHT]
${shot.lighting}

[CAMERA]
${shot.camera}
Portrait/vertical orientation — 9:16, built for Instagram.

[PEOPLE]
${humanPresenceBlock}

[RENDER QUALITY]
PROFESSIONAL CAMPAIGN-READY PHOTOGRAPH for ${brandName}. This is ART-DIRECTED food photography, not a documentation shot. Shot with precision: perfect focus, rich natural colours, tactile textures, depth. Feels like a creative director and professional food photographer collaborated on this specific moment. The styling is INTENTIONAL. The composition is DESIGNED. This is high-end published campaign work that stops scrolls.

[VISUAL COHERENCE & CAMPAIGN IMPACT — APPLY TO EVERY PIXEL]
THIS IMAGE MUST FEEL LIKE IT BELONGS TO ${brandName.toUpperCase()} AND OBVIOUSLY BE CAMPAIGN WORK.

The entire image — set, colors, light, materials, mood, styling — must cohere into a single DESIGNED visual world that says: "This is a professional campaign for ${brandName}."

Professional food photography grounded in ${brandName}'s aesthetic AND elevated by intentional art direction. Light that feels native to the environment but DESIGNED for maximum visual impact — never artificial, never bland, never generic documentary feel.
Real materials with character — surfaces, textures, props — that reflect the brand's personality AND feel chosen, arranged, and styled with purpose. Never seamless backdrops. Never random. Everything is there because a creative director put it there.
Colour grading faithful to the color_world specified above AND pushed for visual richness. Rich or minimal, warm or cool, saturated or natural — whatever fits ${brandName}. Not desaturated, not trending filters. Feels like ${brandName}'s signature visual language elevated to campaign standard.
Architectural, BOLD composition — deliberate negative space, one unmistakable focal point, clean sightlines, strong geometry. Never busy, never cluttered, never competing focal points. The composition should READ as designed.
Maximum two or three intentional props total — every element earns its place, belongs to the brand, and contributes to the designed moment.

[ABSOLUTE HARD NO — ZERO TOLERANCE]
- Any text, letters, words, numbers anywhere — no labels, packaging, chalkboards, signs, stamps, or legible characters. Face away or exclude.
- Watermarks, copyright marks, stock photo artifacts
- Crumpled, folded, or used napkins or tissues
- Props not specified in the set brief — do not invent or add
- Busy or undesigned backgrounds
- Generic restaurant props (chalkboard menus, generic signage)
- Over-manicured or fake-looking hands — real only
- Stock photo aesthetic — artificial perfection, CGI sheen
- Warped or distorted food geometry
- Artificial glow, neon, lens flare, or HDR
- Surreal or non-photorealistic elements
- Multiple competing focal points
- A setting or atmosphere that could belong to ANY restaurant — it must feel specific to ${brandName}`.trim()
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
    const brandVoice = brand_voice_override || brand?.brand_voice || ''

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
      const brandVoice = brand?.brand_voice || 'neutral'
      const captionPrompt = `Write a 1-2 sentence Instagram caption for ${brandName}, a ${brand?.business_type || 'restaurant'} in ${brand?.location || 'the area'}.

Item: ${subjectDesc}
Voice: ${brandVoice}
${postTopic ? `Topic: ${postTopic}` : ''}

Just state it naturally. No hype, no adjectives. Like how the owner would actually talk about it.`

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
