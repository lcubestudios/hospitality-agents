import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export interface DirectorBrief {
  hero_label: string
  camera_angle: string
  background_subject: string
  background_atmosphere: string
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
    camera_angle: 'Three-quarter overhead, classic food editorial',
    background_subject: 'surface or environment',
    background_atmosphere: 'Soft diffused side wash; no hot spots or halos; subtle surface grain.',
    sacred_hierarchy:
      'Preserve all food geometry, plating structure, and background subject identity.',
    creative_direction: {
      lighting_sculpting: 'Rembrandt setup, 45-degree camera-left, soft shadow right',
      lens_intent: '85mm f/1.8, subject sharp, background aggressive bokeh',
      texture_notes: 'Specular highlights, surface grain, tactile material quality',
      color_grade: 'Warm editorial — amber highlights, brown shadows, elevated micro-contrast',
    },
    kinetic_script: {
      camera_vector: 'Slow circular orbit, 90-degree arc around subject, constant pace',
      parallax_priority: 'Foreground faster than background, natural depth separation',
      secondary_motion: 'none',
    },
    expendable_elements: 'Lighting atmosphere and tonal treatment only.',
    image_brief: `Execute a high-end commercial reshoot of the ${subject}. Preserve all food geometry and plating. Override lighting with dramatic side-lit setup. Apply editorial color grade and professional depth of field.`,
    video_brief: `Animate the ${subject} with a lateral trucking shot. Preserve all food geometry and plating. Use natural parallax to reveal scene depth. Physical camera movement only.`,
  }
}

function buildVisionPrompt({
  brandName,
  brandVoice,
  postTopic,
}: {
  brandName: string
  brandVoice: string
  postTopic: string
}): string {
  return `You are a commercial food director analyzing a food or drink photo for a professional campaign reshoot.

Brand: ${brandName || 'not specified'}
Voice: ${brandVoice || 'not specified'}
Post topic: ${postTopic || 'not specified'}

Return ONLY valid JSON:

{
  "hero_label": "",
  "camera_angle": "",
  "background_subject": "",
  "background_atmosphere": "",
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

hero_label: 1-3 word dish/drink name. e.g. "carnitas tacos"

camera_angle: Describe the editorial perspective of this photo as you see it. e.g. "Three-quarter overhead, slight tilt from camera-left" or "Low elevation, slight table-height angle from camera-right". Describe what is in the input — do not choose from a fixed list, do not invent a new angle.

background_subject: 2-5 words identifying the physical background. e.g. "dark wooden table", "marble bar top", "outdoor terrace". What it IS — no quality adjectives.

background_atmosphere: Technical instruction for background re-rendering. Use precise light quality terms: color temperature, diffusion type, shadow depth. e.g. "Soft 2700K side wash from camera-left; no hot spots or halos; subtle surface grain." Avoid vague words — no glow, warm, rich, dramatic.

sacred_hierarchy: Food geometry, ingredient placement, plating structure, and background subject identity must not change.

creative_direction.lighting_sculpting: Describe the EXISTING lighting in this photo precisely. Type of light, direction, quality. e.g. "Natural diffused window light from camera-right, soft shadows, slight underexposure." This will be elevated, not replaced.

creative_direction.lens_intent: Focal length, f-stop, depth. e.g. "85mm f/1.8, subject sharp, background smooth bokeh."

creative_direction.texture_notes: Sensory shorthand for surface elevation. e.g. "Specular highlights on glaze, condensation on glass, organic surface grain."

creative_direction.color_grade: Named editorial grade aligned with brand voice. e.g. "Warm Bangkok street-food — amber highlights, brown shadows, elevated micro-contrast." True-to-life, not oversaturated.

kinetic_script.camera_vector: Choose the motion that best reveals this dish cinematically. Choose one: "Slow circular orbit, 90-degree arc around subject, constant pace" | "Slow dolly dip, camera descends 3 inches toward subject, reveals texture" | "Slow lateral truck, 3 inches right, constant pace". No zoom. No push-pull.

kinetic_script.parallax_priority: Depth relationship during motion. e.g. "Foreground faster than background, natural depth separation."

kinetic_script.secondary_motion: Physically implied motion only. e.g. "Rising steam from surface." If none visible: "none"

expendable_elements: "Lighting atmosphere and tonal treatment only."

image_brief: 2-3 terse declarative sentences for a still image shoot. No apostrophes or double-quotes. No kinematic language.

video_brief: 2-3 terse declarative sentences for a video shoot. Physical cinematography terms only. No color grade language. No apostrophes or double-quotes.

Output ONLY valid JSON.`
}

function buildGeminiPrompt({
  brief,
  subjectAnchor,
  brandName,
  brandVoice,
  postTopic,
}: {
  brief: DirectorBrief
  subjectAnchor: string
  brandName: string
  brandVoice: string
  postTopic: string
}): string {
  return `[PRODUCTION TIER]
Camera: Phase One IQ4 150MP or Hasselblad H6D. Medium format rendering — extreme detail, creamy tonal gradients, true color fidelity.
Lens: ${brief.creative_direction.lens_intent}

[I. THE SCENE — FULL CREATIVE LATITUDE]
The ${brief.background_subject} stays the same surface and material. Everything else is a creative decision.
Lighting: Redesign the lighting completely. Current reads as ${brief.creative_direction.lighting_sculpting}. Build something intentional, dramatic, and editorial in its place. Strong key light. Deep shadow. Hard specular on the hero.
Atmosphere: ${brief.background_atmosphere}
Grade: ${brief.creative_direction.color_grade}

[II. THE ANCHOR — LOCKED]
Only these elements are fixed: ${subjectAnchor} geometry, ingredient placement, item count, and ${brief.background_subject} identity.
Perspective family: ${brief.camera_angle}. Do not flip or radically recompose.
Texture: ${brief.creative_direction.texture_notes}

[III. GUARDRAILS]
Fine dining editorial — Michelin campaign quality. Transformation must be visibly dramatic.
Prohibited: Glowing halos. Neon effects. Artificial saturation boosts. Washed-out midtones. CGI or illustrated look.

Brand: ${brandName} — ${brandVoice}
Post: ${postTopic}`
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
            max_tokens: 1024,
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
    console.log('Brand name:', brandName)
    console.log('Brand voice:', brandVoice)
    console.log('Post topic:', postTopic)

    // STEP 2: Image generation with Gemini 2.5 Flash
    const geminiPrompt = buildGeminiPrompt({
      brief,
      subjectAnchor,
      brandName,
      brandVoice,
      postTopic,
    })
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
