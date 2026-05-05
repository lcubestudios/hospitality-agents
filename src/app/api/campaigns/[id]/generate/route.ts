import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const { image_url: uploadedImageUrl } = await req.json()

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ message: 'GOOGLE_AI_STUDIO_KEY not configured' }, { status: 500 })
    }

    const supabase = await getAuthedSupabaseAdmin()
    await supabase.from('campaigns').update({ status: 'generating' }).eq('id', campaignId)

    // Fetch campaign context
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

    const brandName = brand?.name ?? ''
    const brandDesc = brand?.description ?? ''
    const brandVoice = brand?.brand_voice ?? ''
    const postTopic = campaign?.post_topic ?? ''

    // STEP 1: Vision Analysis with Claude
    interface ImageContext {
      primary_subject: string
      subject_details: string
      surface: {
        type: string
        material: string
        color: string
        visible_condition: string
      }
      background: {
        description: string
        distinct_elements: string
        dominant_colors: string
      }
      lighting: {
        source: string
        direction: string
        quality: string
        shadow_behavior: string
      }
      composition: {
        angle: string
        professional_angle_recommendation: string
      }
      mood: string
      realism_details: string
      generation_guidance: {
        preserve: string
        improve: string
        avoid_changing: string
      }
    }

    let imageContext: ImageContext = {
      primary_subject: '',
      subject_details: '',
      surface: { type: '', material: '', color: '', visible_condition: '' },
      background: { description: '', distinct_elements: '', dominant_colors: '' },
      lighting: { source: '', direction: '', quality: '', shadow_behavior: '' },
      composition: { angle: '', professional_angle_recommendation: '' },
      mood: '',
      realism_details: '',
      generation_guidance: { preserve: '', improve: '', avoid_changing: '' },
    }

    if (uploadedImageUrl) {
      try {
        const imgRes = await fetch(uploadedImageUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          const base64Image = Buffer.from(imgBuffer).toString('base64')

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
                      media_type: 'image/jpeg',
                      data: base64Image,
                    },
                  },
                  {
                    type: 'text',
                    text: `Analyze this product photo and return detailed structured JSON for regeneration.

Identify the primary subject (main product/dish/item). Describe all other elements in relation to it.

Return ONLY valid JSON with this exact structure:
{
  "primary_subject": "The main focal item (e.g., dish, drink, product)",
  "subject_details": "Key physical details: color, texture, preparation state, visible components, size relative to frame",
  "surface": {
    "type": "What it sits on (plate, board, counter, napkin, table, etc.)",
    "material": "Material appearance (ceramic, glass, wood, marble, etc.)",
    "color": "Color(s) and tones",
    "visible_condition": "Texture, wear, cleanliness, reflectiveness (e.g., glossy ceramic, weathered wood, pristine linen)"
  },
  "background": {
    "description": "What's visible beyond the subject and surface (blurred, environmental, plain, etc.)",
    "distinct_elements": "Any recognizable background objects, architecture, or environment cues (e.g., window light, restaurant interior, outdoor setting)",
    "dominant_colors": "Primary background colors and tones"
  },
  "lighting": {
    "source": "Where light appears to come from (window, overhead, side light, mixed sources, etc.)",
    "direction": "Direction from subject's perspective (top-left, front-left, back, diffuse, etc.)",
    "quality": "Lighting character (soft, directional, dappled, harsh, warm, cool, golden, diffuse, etc.)",
    "shadow_behavior": "Shadow characteristics (soft shadows, defined shadows, no visible shadows, dramatic shadows, etc.)"
  },
  "composition": {
    "angle": "Camera angle and perspective (straight-on, overhead, 45-degree, low angle, macro, wide, etc.)",
    "professional_angle_recommendation": "Closest professional/editorial angle standard (e.g., 'overhead flat lay', '45-degree three-quarter view', 'straight-on portrait', 'low-angle dramatic')"
  },
  "mood": "Overall feeling conveyed (warm, inviting, elegant, casual, vibrant, moody, appetizing, etc.)",
  "realism_details": "Small realistic details that ground the image (condensation, crumbs, wear, shadows, depth, reflections, etc.)",
  "generation_guidance": {
    "preserve": "What must stay the same (primary subject's core appearance, recognizable details, surface type, distinct background elements if present)",
    "improve": "What to enhance (lighting quality, color vibrancy, surface texture clarity, composition balance, depth/dimension)",
    "avoid_changing": "What should not be altered (product identity, surface type, lighting direction, camera angle, if realistic)"
  }
}

Rules:
- Be specific and observational, not abstract
- Do not infer details not visible in the image
- Describe only what you can see
- Keep each field concise but complete
- For lighting: describe what you observe, not assumptions
- For realism_details: note imperfections, texture, depth, shadows that make it feel real
- For generation_guidance: be prescriptive about what the regenerated image should preserve vs. improve`,
                  },
                ],
              },
            ],
          })

          const raw = visionRes.content?.[0]?.type === 'text' ? visionRes.content[0].text : ''
          const cleanJson = raw
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/```\s*$/i, '')
            .trim()
          imageContext = JSON.parse(cleanJson)
        }
      } catch (err) {
        console.warn('Vision analysis error, proceeding with fallback:', err)
      }
    }

    // Use structured vision analysis directly in the prompt
    const vision = imageContext

    const negativePrompt = `studio setup, product photography, isolated subject, cutout look, perfectly centered, symmetrical framing, staged presentation, plain white background, sterile background, overly clean, artificial environment, waxy texture, plastic appearance, glossy finish, synthetic material, overly smooth, uniform texture, unrealistic rendering, perfect lighting, flat lighting, evenly lit, artificial gradients, digital highlights, unrealistic shadows, unrealistic light falloff, exaggerated depth of field, artificial blur, unrealistic bokeh, artificial focus effects, AI-generated appearance, CGI look, rendered image, digital enhancement, computer-generated, overly sharp edges, stock photo aesthetic, artificial perfection, hyper-polished, obvious AI, filter applied, edited appearance, color graded`

    // STEP 2: Image Generation with Gemini 2.5 Flash (free tier multimodal image output)
    const fullPrompt = `Generate a realistic, editorial-quality food and beverage image based on the uploaded photo.

Primary subject:
${vision.primary_subject}

Subject details:
${vision.subject_details}

Brand context:
Brand: ${brandName}
Description: ${brandDesc}
Brand voice: ${brandVoice}
Post topic: ${postTopic}

Scene preservation:
Preserve the primary subject and its recognizable details. The generated image should feel like an elevated version of the uploaded photo, not a completely different scene.

Surface:
${vision.surface?.type}, ${vision.surface?.material}, ${vision.surface?.color}, ${vision.surface?.visible_condition}

Background:
${vision.background?.description}

Background treatment:
If the uploaded photo has a clear setting or distinct background elements, preserve them in a subtle, realistic way:
${vision.background?.distinct_elements}

If the uploaded photo has a plain, empty, or unclear background, create a soft neutral background based on these dominant colors:
${vision.background?.dominant_colors}
Use gentle natural blur, not artificial bokeh.

Lighting:
Preserve the visible lighting logic where possible.
Source: ${vision.lighting?.source}
Direction: ${vision.lighting?.direction}
Quality: ${vision.lighting?.quality}
Shadow behavior: ${vision.lighting?.shadow_behavior}

Improve the lighting only enough to feel natural, dimensional, and editorial. Shadows must follow the same direction as the light source. Avoid impossible highlights, mismatched shadows, or flat even lighting.

Composition:
Use the original image angle as the foundation:
${vision.composition?.angle}

Adjust it toward the closest natural professional/editorial angle:
${vision.composition?.professional_angle_recommendation}

Do not force a default overhead angle or default 35mm look unless it matches the uploaded photo. Maintain realistic camera perspective, natural framing, and believable depth.

Mood:
${vision.mood}

Realism details to preserve:
${vision.realism_details}

Generation guidance:
Preserve:
${vision.generation_guidance?.preserve}

Improve:
${vision.generation_guidance?.improve}

Avoid changing:
${vision.generation_guidance?.avoid_changing}

The final image should feel real, grounded, and naturally photographed. Prioritize believable light, material texture, imperfect details, and scene continuity over visual perfection.

Avoid: ${negativePrompt}`

    const genRes = await fetch(
      `${BASE_URL}/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            response_modalities: ['IMAGE'],
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_ONLY_HIGH',
            },
            {
              category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
              threshold: 'BLOCK_ONLY_HIGH',
            },
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

    const generatedBase64 = imagePart.inlineData.data

    const generatedBuffer = Buffer.from(generatedBase64, 'base64')

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

    // Save asset record
    const { data: asset, error: assetError } = await supabase
      .from('assets')
      .insert({ campaign_id: campaignId, asset_type: 'image', asset_url: enhancedImageUrl })
      .select()
      .single()

    if (assetError) {
      return NextResponse.json({ message: assetError.message }, { status: 400 })
    }

    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)

    return NextResponse.json({ asset_url: enhancedImageUrl, asset })
  } catch (err) {
    console.error('Generation error:', err)
    return NextResponse.json({ message: 'Generation failed' }, { status: 500 })
  }
}
