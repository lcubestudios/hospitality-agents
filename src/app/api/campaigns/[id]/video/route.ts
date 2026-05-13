import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { type DirectorBrief, buildVisionPrompt, buildFallbackBrief } from '../generate/route'

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

function buildVeoPrompt({
  brief,
  subjectAnchor,
}: {
  brief: DirectorBrief
  subjectAnchor: string
}): string {
  return `[PRODUCTION TIER]
Camera: ARRI Alexa Mini LF, 100mm f/2.8 Macro. Cinematic 4K. Natural highlight rolloff. True color response. Vertical 9:16 Studio Format.

[TIER 1 — LOCKED]
${brief.tier_1_locked}
Hero anchor: ${subjectAnchor}
Perspective: ${brief.camera_angle}. Maintain this perspective family throughout the clip.
The food geometry, item count, ingredient placement, plating structure, and visible background identity must not change.
No garnish generation. No edge decoration. No negative-space filling.
Do not invent crumbs, herbs, sauces, side textures, steam sources, reflections, utensils, or plating accents that are not explicitly visible in the source image.

[TIER 2 — ENHANCED]
${brief.tier_2_enhanced}
Lighting: ${brief.creative_direction.lighting_refinement}
Texture: ${brief.creative_direction.texture_notes}
Optics: ${brief.creative_direction.lens_intent}
Refine what is already present. Do not replace the subject, plating, or background identity.

[TIER 3 — REIMAGINED]
${brief.tier_3_reimagined}
Color: ${brief.creative_direction.color_grade}
Atmosphere, tonal mood, and depth may be improved while keeping the visible scene recognizable.

[MOTION]
Camera Vector: ${brief.kinetic_script.camera_vector}
Parallax: ${brief.kinetic_script.parallax_priority}
Secondary Motion: ${brief.kinetic_script.secondary_motion}
Speed: Controlled physical camera movement. Movement should feel observational and restrained, like a real handheld or stabilized food shoot. Never theatrical, aggressive, or overly cinematic.
Start: Begin with stable composition for the first few frames, then introduce motion naturally. No fade-ins or artificial transitions.
Geometry: The base geometry of the dish must remain 100% static on the surface. Movement is purely camera-based.
Timing: Complete the full motion story by the 4-second mark.
Framing: Hero subject stays inside the center 70% safe zone throughout. Keep environmental breathing room. Never crop aggressively into the food.
Format: 9:16 portrait.

[GUARDRAILS]
Faithful food documentation. Clean plate.
Zero Typography. The frame must be 100% free of all characters, subtitles, watermarks, scripts, lower-thirds, logo overlays, and digital artifacts. The pixels consist only of food, plating, and background. Silent. No audio.
Fixed 100mm focal length. Zero lens magnification changes. No zoom. No pan. No tilt. No orbit. No dolly-in. No push-pull. No new objects. No added hands. No added people. No change to item count. No altered plating.
No glowing halos. No neon effects. No artificial saturation. No CGI look. No warped food geometry.
Render all surfaces with organic, tactile grain. Use soft shadow roll-off and physics-based specular highlights only.
Preserve only the textures already visible in the source image. Do not generate additional food texture, garnish texture, moisture, crumbs, or surface detail.
Movement is physical camera movement only. The scene must remain empty of all camera equipment, vehicles, production tools, and crew. The camera moves through space invisibly.

Directive: ${brief.video_final_prompt}
Goal: 9:16 vertical, 4–5 seconds.`.trim()
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const { image_url: imageUrl, director_brief: incomingBrief } = await req.json()

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ message: 'GOOGLE_AI_STUDIO_KEY not configured' }, { status: 500 })
    }

    const supabase = await getAuthedSupabaseAdmin()

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

    const veoPrompt = buildVeoPrompt({ brief, subjectAnchor })
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
