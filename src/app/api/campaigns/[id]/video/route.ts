import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import type { DirectorBrief } from '../generate/route'

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

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

function buildVeoPrompt({
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
Camera: ARRI Alexa Mini LG with Cooke S4/i prime lens. Cinematic 4K. Film-like tonal response, true color, beautiful highlight rolloff.

[I. THE SCENE — FULL CREATIVE LATITUDE]
The ${brief.background_subject} stays the same surface and material. Everything else is a creative decision.
Lighting: Redesign the lighting completely. Current reads as ${brief.creative_direction.lighting_sculpting}. Build something intentional, dramatic, and editorial. Strong key light. Deep shadow. Hard specular on the hero.
Atmosphere: ${brief.background_atmosphere}

[II. THE ANCHOR — LOCKED]
Only these elements are fixed: ${subjectAnchor} geometry, ingredient placement, item count, and ${brief.background_subject} identity.
Perspective family: ${brief.camera_angle}. Maintain throughout the clip.

[III. MOTION]
Camera Vector: ${brief.kinetic_script.camera_vector}
Parallax: ${brief.kinetic_script.parallax_priority}
Secondary Motion: ${brief.kinetic_script.secondary_motion}
Hard Constraints: Lateral or arc camera movement only. Absolutely no zoom. No dolly toward subject. Focal length stays constant the entire clip. Do not add new objects or change item counts.

[IV. GUARDRAILS]
Fine dining editorial — Michelin campaign quality. Transformation must be visibly dramatic.
Prohibited: Glowing halos. Neon effects. Artificial saturation. CGI look. Zoom. New objects.

Brand: ${brandName} — ${brandVoice}
Post: ${postTopic}
Goal: High-end commercial food video. 9:16 vertical, 8 seconds.`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const { image_url: imageUrl, director_brief: incomingBrief } = await req.json()

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ message: 'GOOGLE_AI_STUDIO_KEY not configured' }, { status: 500 })
    }

    const supabase = await getAuthedSupabaseAdmin()

    // Fetch campaign + brand context
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

    // Use cached brief from image gen if provided, otherwise run Vision
    let brief: DirectorBrief = incomingBrief ?? buildFallbackBrief(postTopic)
    let uploadedBase64 = ''
    let uploadedMimeType = 'image/jpeg'

    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
          const base64Image = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
          uploadedBase64 = base64Image
          uploadedMimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'

          if (!incomingBrief) {
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
                        data: base64Image,
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
            console.log('Video Vision analysis result:', JSON.stringify(brief, null, 2))
          }
        }
      } catch (err) {
        console.warn('Vision analysis for video failed, using fallback brief:', err)
      }
    }

    const subjectAnchor = postTopic.trim() || brief.hero_label
    console.log('Video subjectAnchor:', subjectAnchor)

    const veoPrompt = buildVeoPrompt({
      brief,
      subjectAnchor,
      brandName,
      brandVoice,
      postTopic,
    })
    console.log('Veo prompt:', veoPrompt)

    // STEP 1: Submit video generation job to Veo 3 Fast
    const genRes = await fetch(
      `${BASE_URL}/models/veo-3.0-fast-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [
            {
              prompt: veoPrompt,
              ...(uploadedBase64
                ? { image: { bytesBase64Encoded: uploadedBase64, mimeType: uploadedMimeType } }
                : {}),
            },
          ],
          parameters: {
            aspectRatio: '9:16',
            durationSeconds: 8,
          },
        }),
      },
    )

    if (!genRes.ok) {
      const errText = await genRes.text()
      console.error(`Veo generation error (${genRes.status}):`, errText)
      return NextResponse.json({ message: 'Video generation failed' }, { status: 500 })
    }

    const { name: operationName } = await genRes.json()

    // STEP 2: Poll until done (max 3 minutes, every 5s)
    let videoUri: string | null = null
    const maxAttempts = 36

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000))

      const pollRes = await fetch(`${BASE_URL}/${operationName}?key=${GOOGLE_API_KEY}`)
      if (!pollRes.ok) continue

      const pollData = await pollRes.json()
      if (pollData.done) {
        videoUri =
          pollData.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null
        break
      }
    }

    if (!videoUri) {
      return NextResponse.json({ message: 'Video generation timed out' }, { status: 500 })
    }

    // STEP 3: Download video from Google
    const videoRes = await fetch(`${videoUri}&key=${GOOGLE_API_KEY}`)
    if (!videoRes.ok) {
      return NextResponse.json({ message: 'Failed to download generated video' }, { status: 500 })
    }

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer())

    // STEP 4: Upload to Supabase Storage
    const storagePath = `${campaignId}/video.mp4`
    const { error: uploadError } = await supabase.storage
      .from('campaign-uploads')
      .upload(storagePath, videoBuffer, { contentType: 'video/mp4', upsert: true })

    if (uploadError) {
      return NextResponse.json({ message: uploadError.message }, { status: 400 })
    }

    const { data: publicUrlData } = supabase.storage
      .from('campaign-uploads')
      .getPublicUrl(storagePath)

    const videoUrl = publicUrlData.publicUrl

    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({ campaign_id: campaignId, asset_type: 'video', asset_url: videoUrl })
      .select()
      .single()

    if (assetError) {
      return NextResponse.json({ message: assetError.message }, { status: 400 })
    }

    return NextResponse.json({ asset_url: videoUrl, asset })
  } catch (err) {
    console.error('Video generation error:', err)
    return NextResponse.json({ message: 'Video generation failed' }, { status: 500 })
  }
}
