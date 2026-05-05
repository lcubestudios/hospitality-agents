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

creative_direction.color_grade: Name a specific editorial grade aligned with the brand voice. Include highlight temperature, shadow treatment, and contrast character.

kinetic_script.camera_vector: Specify a cinematography movement type and magnitude. Allowed: trucking shot, dolly, orbital arc, tilt-up, parallax drift. Never zoom or smooth animation.

kinetic_script.parallax_priority: Describe the foreground/background depth relationship during camera movement. Background must remain structurally recognizable if visible in original.

kinetic_script.secondary_motion: Identify natural motion opportunities physically implied by the image — steam, condensation, garnish flutter. If none are clearly visible, write exactly: none

expendable_elements: Only lighting atmosphere and tonal treatment are expendable. Food geometry, plating, and environmental background are never expendable.

image_brief: 3-5 sentences for a still image shoot. No kinematic language. No apostrophes or double-quotes.

video_brief: 3-5 sentences for a video shoot using physical cinematography terms. No color grade language. No apostrophes or double-quotes.

Output ONLY valid JSON.`
}

function buildVeoPrompt({
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
  return `${brief.video_brief}

Sacred Hierarchy — do not change:
Hero: ${subjectAnchor}
${brief.sacred_hierarchy}

Kinetic Direction:

Camera Vector:
${brief.kinetic_script.camera_vector}

Parallax Priority:
${brief.kinetic_script.parallax_priority}

Secondary Motion:
${brief.kinetic_script.secondary_motion}

Brand Context:
Brand: ${brandName}
Description: ${brandDesc}
Voice: ${brandVoice}
Post Topic: ${postTopic}

Sacred Constraints:
- Preserve exact food geometry, ingredient placement, and plating structure
- Preserve the environmental background exactly as photographed
- Subject must remain fully visible at all times
- Do not add extra dishes, drinks, props, utensils, or scene elements
- Do not structurally transform the food or plate

Motion Constraints:
- Use physical cinematography movement only
- Allowed: trucking shot, dolly, orbital arc, tilt, parallax drift
- Never: zoom, aggressive push-in, floating movement, random drift
- Never: fake cinematic sway

Depth and Framing:
- Maintain environmental breathing room
- Never crop tighter into the food over time
- Preserve believable foreground/background parallax
- Movement should reveal dimensionality, not magnify the subject

Instagram Format:
- 9:16 vertical, 8 seconds
- Compose for mobile-first viewing

This is a commercial, not a security camera. Move with intention.`
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
    const brandDesc = brand?.description ?? ''
    const brandVoice = brand?.brand_voice ?? ''

    // Use cached brief from image gen if provided, otherwise run Vision
    let brief: DirectorBrief = incomingBrief ?? buildFallbackBrief(postTopic)
    let uploadedBase64 = ''

    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl)
        if (imgRes.ok) {
          const base64Image = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
          uploadedBase64 = base64Image

          if (!incomingBrief) {
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
                        data: base64Image,
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
        }
      } catch (err) {
        console.warn('Vision analysis for video failed, using fallback brief:', err)
      }
    }

    const subjectAnchor = postTopic.trim() || brief.hero_label

    const veoPrompt = buildVeoPrompt({
      brief,
      subjectAnchor,
      brandName,
      brandDesc,
      brandVoice,
      postTopic,
    })

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
                ? { image: { bytesBase64Encoded: uploadedBase64, mimeType: 'image/jpeg' } }
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
