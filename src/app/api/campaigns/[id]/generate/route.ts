import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export interface DirectorBrief {
  hero_label: string
  sacred_hierarchy: string
  creative_direction: {
    lighting_sculpting: string
    lens_intent: string
    texture_notes: string
    color_grade: string
  }
  kinetic_script: {
    camera_vector: string
    parallax_priority: string
    secondary_motion: string
  }
  expendable_elements: string
  image_brief: string
  video_brief: string
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

function buildFallbackBrief(postTopic: string): DirectorBrief {
  const subject = postTopic || 'food subject'
  return {
    hero_label: subject,
    sacred_hierarchy:
      'Preserve all food geometry, plating structure, and environmental background exactly as photographed.',
    creative_direction: {
      lighting_sculpting:
        'Warm directional side light from camera left at 45 degrees, soft shadow pooling on the right side of the plate',
      lens_intent: '85mm equivalent at f/2.8, subject tack-sharp, background falls into soft focus',
      texture_notes:
        'Render surface textures with natural tactile quality, realistic specular highlights, and visible material grain',
      color_grade:
        'Warm editorial grade with amber highlights, softened brown shadows, and elevated micro-contrast',
    },
    kinetic_script: {
      camera_vector: 'Slow horizontal trucking shot, 3-inch slide to the right at constant pace',
      parallax_priority:
        'Foreground subject moves faster than background, creating natural depth separation',
      secondary_motion: 'none',
    },
    expendable_elements: 'Current lighting atmosphere and tonal treatment',
    image_brief: `Using the ${subject} as hero, execute a high-end commercial reshoot. Keep all food geometry and plating identical. Discard current lighting and apply warm directional side light from camera left. Render with editorial color grade and professional depth of field. Do not add any new objects, dishes, or scene elements.`,
    video_brief: `Animate the ${subject} with a slow horizontal trucking shot moving 3 inches to the right. Keep all food geometry and plating identical. Use natural parallax to reveal scene depth. Camera movement should feel like a high-end commercial. Do not add any new objects, dishes, or scene elements.`,
  }
}

function buildVisionPrompt({
  brandName,
  brandDesc,
  brandVoice,
  postTopic,
}: {
  brandName: string
  brandDesc: string
  brandVoice: string
  postTopic: string
}): string {
  return `You are a commercial food cinematography director analyzing an uploaded food or drink image.

This content will be published on Instagram. Your job is NOT to describe the photo literally. Extract what the image should BECOME — a high-end commercial reshoot that keeps the food identical but elevates everything else.

Brand context (use to align color grade and mood):
Brand: ${brandName || 'not specified'}
Description: ${brandDesc || 'not specified'}
Voice: ${brandVoice || 'not specified'}
Post topic: ${postTopic || 'not specified'}

Return ONLY valid JSON in this exact shape:

{
  "hero_label": "",
  "sacred_hierarchy": "",
  "creative_direction": {
    "lighting_sculpting": "",
    "lens_intent": "",
    "texture_notes": "",
    "color_grade": ""
  },
  "kinetic_script": {
    "camera_vector": "",
    "parallax_priority": "",
    "secondary_motion": ""
  },
  "expendable_elements": "",
  "image_brief": "",
  "video_brief": ""
}

Rules:

hero_label: 1-3 word dish/drink name only (e.g. "carnitas tacos", "espresso martini")

sacred_hierarchy: Describe exactly what must not change — food geometry, ingredient placement, plating structure, visible surface and environmental background. Lighting and atmosphere are NOT sacred.

creative_direction.lighting_sculpting: Specify source angle (e.g. "45 degrees camera-left"), quality (hard/soft/diffused), and shadow placement. Must be directional — never flat or overhead.

creative_direction.lens_intent: Specify focal length equivalent, f-stop, and depth behavior (e.g. "85mm at f/2.8, subject sharp, background falls into gentle focus").

creative_direction.texture_notes: Describe tactile rendering priorities using sensory language — moisture, translucence, oil sheen, crispness, char, condensation, grain, surface irregularities. No generic quality language.

creative_direction.color_grade: Name a specific editorial grade aligned with the brand voice. Include highlight temperature, shadow treatment, and contrast character (e.g. "warm Bangkok street-food — amber highlights, softened brown shadows, elevated micro-contrast").

kinetic_script.camera_vector: Specify a cinematography movement type and magnitude. Allowed: trucking shot, dolly, orbital arc, tilt-up, parallax drift. Never zoom or smooth animation.

kinetic_script.parallax_priority: Describe the foreground/background depth relationship during camera movement. Background must remain structurally recognizable if visible in original.

kinetic_script.secondary_motion: Identify natural motion opportunities physically implied by the image — steam, condensation, garnish flutter. If none are clearly visible, write exactly: none

expendable_elements: Only lighting atmosphere and tonal treatment are expendable. Food geometry, plating, and environmental background are never expendable.

image_brief: 3-5 sentences written as instructions to a commercial director for a still image shoot. Must explicitly permit creative freedom in lighting, atmosphere, depth, and color. Must explicitly forbid scene expansion or added objects. No kinematic language. IMPORTANT: Use plain declarative sentences only — no apostrophes, no double-quote characters.

video_brief: 3-5 sentences written as instructions to a commercial director for a video shoot. Must describe camera movement using physical cinematography terms. Must explicitly forbid scene expansion or added objects. No color grade language. IMPORTANT: Use plain declarative sentences only — no apostrophes, no double-quote characters.

Do NOT: describe the image plainly, invent new food items or props, expand into a restaurant spread, mention AI, output markdown, output explanation.

Output ONLY valid JSON.`
}

function buildGeminiPrompt({
  brief,
  subjectAnchor,
  brandName,
  brandDesc,
  brandVoice,
  postTopic,
}: {
  brief: DirectorBrief
  subjectAnchor: string
  brandName: string
  brandDesc: string
  brandVoice: string
  postTopic: string
}): string {
  return `${brief.image_brief}

Sacred Hierarchy — do not change:
Hero: ${subjectAnchor}
${brief.sacred_hierarchy}

Lighting:
${brief.creative_direction.lighting_sculpting}

Lens:
${brief.creative_direction.lens_intent}

Texture Rendering:
${brief.creative_direction.texture_notes}

Color Grade:
${brief.creative_direction.color_grade}

Brand Context:
Brand: ${brandName}
Description: ${brandDesc}
Voice: ${brandVoice}
Post Topic: ${postTopic}

Sacred Constraints:
- Preserve exact food geometry, ingredient placement, and plating structure
- Preserve the environmental background structure exactly as photographed
- Do not add extra dishes, drinks, props, utensils, or background elements
- Do not reinterpret the composition into a broader scene

Creative Latitude:
- Lighting atmosphere, direction, and quality may evolve
- Tonal treatment and color grade may evolve
- Depth treatment and lens character may evolve
- Texture realism and surface dimensionality should be elevated

Instagram Format:
- Compose for portrait or square format
- Clear subject hierarchy optimized for mobile-first viewing

Negative Prompt:
digital zoom, plastic appearance, CGI look, AI-generated appearance, watermarks, text overlays, logos, flat lighting, studio setup, waxy texture, oversharpening, stock photo aesthetic, fake restaurant spread, extra dishes, added drinks, invented props, artificial symmetry, perfectly centered composition`
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

    // Fetch campaign + brand context before Vision
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
    const brandDesc = brand?.description ?? ''
    const brandVoice = brand?.brand_voice ?? ''

    // STEP 1: Vision analysis — Director's Brief
    let brief: DirectorBrief = buildFallbackBrief(postTopic)
    let uploadedBase64 = ''

    if (uploadedImageUrl) {
      try {
        const imgRes = await fetch(uploadedImageUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          uploadedBase64 = Buffer.from(imgBuffer).toString('base64')
          const mimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'

          const client = new Anthropic()
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
                      media_type: mimeType as
                        | 'image/jpeg'
                        | 'image/png'
                        | 'image/gif'
                        | 'image/webp',
                      data: uploadedBase64,
                    },
                  },
                  {
                    type: 'text',
                    text: buildVisionPrompt({ brandName, brandDesc, brandVoice, postTopic }),
                  },
                ],
              },
            ],
          })

          const raw = visionRes.content?.[0]?.type === 'text' ? visionRes.content[0].text : ''
          const parsed = safeParseJson<DirectorBrief>(raw)
          if (parsed?.hero_label) brief = parsed
        }
      } catch (err) {
        console.warn('Vision analysis failed, using fallback brief:', err)
      }
    }

    const subjectAnchor = postTopic.trim() || brief.hero_label

    // STEP 2: Image generation with Gemini 2.5 Flash
    const geminiPrompt = buildGeminiPrompt({
      brief,
      subjectAnchor,
      brandName,
      brandDesc,
      brandVoice,
      postTopic,
    })

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
                  ? [{ inline_data: { mime_type: 'image/jpeg', data: uploadedBase64 } }]
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
