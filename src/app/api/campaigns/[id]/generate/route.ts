import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export interface DirectorBrief {
  hero_label: string
  dish_shape: 'tall' | 'wide'
  camera_angle: string
  background_subject: string
  tier_1_locked: string
  tier_2_enhanced: string
  tier_3_reimagined: string
  creative_direction: {
    lighting_refinement: string
    lens_intent: string
    texture_notes: string
    color_grade: string
  }
  kinetic_script: {
    camera_vector: string
    parallax_priority: string
    secondary_motion: string
  }
  image_final_prompt: string
  video_final_prompt: string
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

export function buildFallbackBrief(postTopic: string): DirectorBrief {
  const subject = postTopic || 'food subject'
  return {
    hero_label: subject,
    dish_shape: 'wide',
    camera_angle: 'Three-quarter overhead, classic food editorial',
    background_subject: 'surface or environment',
    tier_1_locked: `${subject} geometry, ingredient placement, plating structure, and background surface identity are fixed. No additions, no deletions.`,
    tier_2_enhanced:
      'Refine existing lighting with specular highlights and soft shadow roll-off. Enhance surface textures and optical depth.',
    tier_3_reimagined:
      'Re-grade background tonal mood for premium editorial feel. Add subtle atmospheric depth. Keep visible scene recognizable.',
    creative_direction: {
      lighting_refinement:
        "Low-Key Chiaroscuro. Rim-lighting from 10 o'clock. Specular highlights on surface. Crushed shadow roll-off.",
      lens_intent:
        'Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background bokeh.',
      texture_notes: 'Specular highlights, surface grain, tactile material quality.',
      color_grade:
        'Commercial Editorial Grade — Warm, True-to-Life Tones, Zero Oversaturation, Crushed Blacks in the Shadows.',
    },
    kinetic_script: {
      camera_vector:
        'Lateral Tracking Shot (Sideways Slide), 4 inches left to right. High Frame-Rate Cinematic Drift.',
      parallax_priority:
        'Prioritize background parallax separation — foreground faster than background, maximum 3D depth.',
      secondary_motion: 'none',
    },
    image_final_prompt: `Professional commercial reshoot of ${subject}. Tier 1 locked. Tier 2 lighting refinement with specular highlights. Tier 3 editorial color grade.`,
    video_final_prompt: `${subject} master footage. Horizontal camera displacement, 4-inch slide. Tier 1 locked. Tier 2 lighting refined. Tier 3 atmosphere re-graded. Natural parallax.`,
  }
}

export function buildVisionPrompt({
  brandName,
  brandVoice,
  postTopic,
}: {
  brandName: string
  brandVoice: string
  postTopic: string
}): string {
  return `You are a professional cinematographer and creative director analyzing an uploaded food or drink photo for a premium Instagram campaign reshoot.

Brand: ${brandName || 'not specified'}
Brand voice: ${brandVoice || 'not specified'}
Post topic: ${postTopic || 'not specified'}

Your job is to create a Director's Brief for downstream image and video generation.

Return ONLY valid JSON in this exact shape:

{
  "hero_label": "",
  "dish_shape": "",
  "camera_angle": "",
  "background_subject": "",
  "tier_1_locked": "",
  "tier_2_enhanced": "",
  "tier_3_reimagined": "",
  "creative_direction": {
    "lighting_refinement": "",
    "lens_intent": "",
    "texture_notes": "",
    "color_grade": ""
  },
  "kinetic_script": {
    "camera_vector": "",
    "parallax_priority": "",
    "secondary_motion": ""
  },
  "image_final_prompt": "",
  "video_final_prompt": ""
}

Rules:

hero_label:
- 1–3 word plain dish/drink name.

dish_shape:
- Classify as exactly one of:
  - "tall" for burgers, cocktails, shakes, stacked desserts, vertical items
  - "wide" for bowls, tacos, steaks, plates, platters, flat dishes, spread dishes

camera_angle:
- Faithfully describe the input photo perspective.
- Do not invent a new angle.

background_subject:
- 2–5 words describing what the background physically is.
- No quality adjectives.
- Examples: "wood table", "stone countertop", "restaurant booth", "plain wall", "metal tray"

tier_1_locked:
- Food geometry, item count, ingredient placement, plating structure, and visible background identity are locked.
- State exactly what must not change.
- Do not allow new dishes, drinks, utensils, props, hands, people, or expanded table settings.

tier_2_enhanced:
- Existing lighting quality, surface texture, optical depth, and dimensionality may be refined.
- Use language like lighting refinement, specular highlights, tactile grain, soft shadow roll-off.
- Do not replace the dish, plating, or background identity.

tier_3_reimagined:
- Background grade, tonal mood, atmospheric depth, and subtle effects may be creatively improved.
- Keep the visible background identity recognizable.
- Atmosphere may evolve, but the scene must not become a different place.

creative_direction.lighting_refinement:
- Assess the existing light and subject position. Prescribe refinement toward Low-Key Chiaroscuro or Rim-lighting from an appropriate angle (e.g., 10–2 o'clock range) based on observed geometry.
- Use physics-based terms: chiaroscuro, rim light, color temperature, specular highlights, crushed shadow roll-off.
- Do not use: dramatic, glow, redesign, neon, surreal.

creative_direction.lens_intent:
- Always return exactly: "Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background bokeh."

creative_direction.texture_notes:
- Use sensory surface language based on the visible subject.
- Mention only visible or physically plausible details such as condensation, glaze sheen, char, steam, crisp edges, oil sheen, moisture, matte grain.

creative_direction.color_grade:
- Always return exactly: "Commercial Editorial Grade — Warm, True-to-Life Tones, Zero Oversaturation, Crushed Blacks in the Shadows."

kinetic_script.camera_vector:
- Choose based on dish_shape.
- If dish_shape is "tall": return "Vertical Jib Rise, 4 inches upward from plate level. High Frame-Rate Cinematic Drift."
- If dish_shape is "wide": return "Lateral Tracking Shot (Sideways Slide), 4 inches left to right. High Frame-Rate Cinematic Drift."
- No pan. No tilt. No orbit. No zoom. No push toward subject. No push-pull.

kinetic_script.parallax_priority:
- Always return: "Prioritize background parallax separation — foreground faster than background, maximum 3D depth."
- Keep the hero subject within the center 70% of the 9:16 frame.

kinetic_script.secondary_motion:
- Physically implied motion only.
- Examples: rising steam, condensation drift, slight garnish movement.
- If none is visible or plausible, return "none."

image_final_prompt:
- 2–3 terse declarative sentences for Gemini.
- Reference the three tiers.
- No kinematic language.

video_final_prompt:
- 2–3 terse declarative sentences for Veo.
- Use physical cinematography terms only: "master footage," "cinematic plate," "editorial render," "camera displacement."
- Reference the three tiers and selected camera vector.
- Never use: "commercial," "ad," "campaign," "reel," "promo," "social media," or any brand/marketing language.

Output ONLY valid JSON.
No markdown.
No explanation.`.trim()
}

function buildGeminiPrompt({
  brief,
  subjectAnchor,
}: {
  brief: DirectorBrief
  subjectAnchor: string
}): string {
  return `[PRODUCTION TIER]
Camera: Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background: creamy bokeh.
Quality: Commercial Editorial — Direct-to-Advertising register. Maximum surface definition. Physics-based specular highlights on all appropriate surfaces.

[TIER 1 — LOCKED]
${brief.tier_1_locked}
Hero anchor: ${subjectAnchor}
Perspective: ${brief.camera_angle}. Do not flip or radically recompose.

[TIER 2 — ENHANCED]
${brief.tier_2_enhanced}
Lighting: ${brief.creative_direction.lighting_refinement}
Texture: ${brief.creative_direction.texture_notes}
Optics: ${brief.creative_direction.lens_intent}

[TIER 3 — REIMAGINED]
${brief.tier_3_reimagined}
Color: ${brief.creative_direction.color_grade}

[GUARDRAILS]
Premium commercial food editorial. Billboard quality.
No new objects. No added hands. No added people. No change to item count. No altered plating.
No glowing halos. No neon effects. No artificial saturation. No CGI look. No warped food geometry.
Render all surfaces with organic, tactile grain. Soft shadow roll-off and physics-based specular highlights only.
Natural saturation. True-to-life tones.

Directive: ${brief.image_final_prompt}`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const { image_url: uploadedImageUrl } = await req.json()

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

    const postTopic = campaign?.post_topic ?? ''

    const { data: brand } = campaign
      ? await supabase
          .from('brands')
          .select('name, description, brand_voice')
          .eq('id', campaign.brand_id)
          .single()
      : { data: null }

    const brandName = brand?.name ?? ''
    const brandVoice = brand?.brand_voice ?? ''

    // STEP 1: Vision analysis — Director's Brief
    let brief: DirectorBrief = buildFallbackBrief(postTopic)
    let uploadedBase64 = ''
    let uploadedMimeType = 'image/jpeg'

    if (uploadedImageUrl) {
      try {
        const imgRes = await fetch(uploadedImageUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          uploadedBase64 = Buffer.from(imgBuffer).toString('base64')
          uploadedMimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'

          const client = new Anthropic()
          const visionRes = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
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
                    text: buildVisionPrompt({ brandName, brandVoice, postTopic }),
                  },
                ],
              },
            ],
          })

          const raw = visionRes.content?.[0]?.type === 'text' ? visionRes.content[0].text : ''
          const parsed = safeParseJson<DirectorBrief>(raw)
          if (parsed?.hero_label) brief = parsed
          console.log('Vision analysis result:', JSON.stringify(brief, null, 2))
        }
      } catch (err) {
        console.warn('Vision analysis failed, using fallback brief:', err)
      }
    }

    const subjectAnchor = postTopic.trim() || brief.hero_label
    console.log('Subject anchor:', subjectAnchor)

    // STEP 2: Image generation with Gemini 2.5 Flash
    const geminiPrompt = buildGeminiPrompt({ brief, subjectAnchor })
    console.log('Gemini prompt:', geminiPrompt)

    const genRes = await fetch(
      `${BASE_URL}/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: geminiPrompt },
                ...(uploadedBase64
                  ? [{ inline_data: { mime_type: uploadedMimeType, data: uploadedBase64 } }]
                  : []),
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

    if (!genRes.ok) {
      const errText = await genRes.text()
      console.error(`Gemini generation error (${genRes.status}):`, errText)
      return NextResponse.json({ message: 'Image generation failed' }, { status: 500 })
    }

    const genData = await genRes.json()

    if (!genData.candidates?.[0]) {
      console.error('No candidates in Gemini response:', genData)
      return NextResponse.json({ message: 'Image generation failed' }, { status: 500 })
    }

    const imagePart = genData.candidates[0].content?.parts?.find(
      (part: { inlineData?: { mimeType?: string; data?: string } }) =>
        part.inlineData?.mimeType?.startsWith('image/'),
    )

    if (!imagePart?.inlineData?.data) {
      console.error(
        'No image data in Gemini response. Prompt may have been blocked by safety filters.',
      )
      return NextResponse.json(
        {
          message:
            'Image generation blocked - try describing colors/shapes instead of product types',
        },
        { status: 500 },
      )
    }

    const generatedBuffer = Buffer.from(imagePart.inlineData.data, 'base64')

    // STEP 3: Upload to Supabase Storage
    const storagePath = `${campaignId}/enhanced.jpg`
    const { error: uploadError } = await supabase.storage
      .from('campaign-uploads')
      .upload(storagePath, generatedBuffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) {
      return NextResponse.json({ message: uploadError.message }, { status: 400 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('campaign-uploads')
      .getPublicUrl(storagePath)

    const enhancedImageUrl = publicUrlData.publicUrl

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({ campaign_id: campaignId, asset_type: 'image', asset_url: enhancedImageUrl })
      .select()
      .single()

    if (assetError) {
      return NextResponse.json({ message: assetError.message }, { status: 400 })
    }

    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)

    return NextResponse.json({ asset_url: enhancedImageUrl, asset, director_brief: brief })
  } catch (err) {
    console.error('Generation error:', err)
    return NextResponse.json({ message: 'Generation failed' }, { status: 500 })
  }
}
