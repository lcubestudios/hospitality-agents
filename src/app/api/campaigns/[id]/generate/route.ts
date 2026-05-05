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
        color_palette: string
      }
      background: {
        type: string
        dominant_colors: string
      }
      lighting: {
        type: string
        direction: string
        intensity: string
      }
      composition: {
        angle: string
        framing: string
        focal_point: string
      }
    }

    let imageContext: ImageContext = {
      primary_subject: '',
      subject_details: '',
      surface: { type: '', color_palette: '' },
      background: { type: '', dominant_colors: '' },
      lighting: { type: '', direction: '', intensity: '' },
      composition: { angle: '', framing: '', focal_point: '' },
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
                    text: `Analyze this product photo and return structured JSON describing the scene.

Identify the primary subject (the main product/dish/item). All other elements should be described in relation to this subject.

Return valid JSON with exactly this structure:
{
  "primary_subject": "The main focal item (e.g., dish, drink, product)",
  "subject_details": "Key physical details: color, texture, preparation state, visible components",
  "surface": {
    "type": "What the product sits on (plate, board, counter, etc.)",
    "color_palette": "Colors and tones of the surface"
  },
  "background": {
    "type": "Background context (blurred, minimal, environmental)",
    "dominant_colors": "Primary background colors"
  },
  "lighting": {
    "type": "Lighting style (natural, soft, directional, overhead, etc.)",
    "direction": "Where light comes from",
    "intensity": "Brightness level (soft, moderate, bright)"
  },
  "composition": {
    "angle": "Camera angle (straight-on, overhead, 45-degree, etc.)",
    "framing": "How subject is framed (centered, off-center, tight, wide)",
    "focal_point": "What draws the eye first"
  }
}

Rules:
- Be specific and concrete, not abstract
- Do not infer, assume, or make up details not visible
- Do not describe techniques or processes, only the visible result
- Keep descriptions concise but informative
- Return ONLY valid JSON`,
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

    const productDetails = [
      imageContext.primary_subject,
      imageContext.subject_details,
      `Surface: ${imageContext.surface?.type} with ${imageContext.surface?.color_palette}`,
      `Background: ${imageContext.background?.type}`,
      `Lighting: ${imageContext.lighting?.type} from ${imageContext.lighting?.direction}`,
      `Composition: ${imageContext.composition?.angle} angle, ${imageContext.composition?.framing} framing`,
    ]
      .filter((line) => line && !line.endsWith(': '))
      .join('\n')

    const negativePrompt = `studio setup, product photography, isolated subject, cutout look, perfectly centered, symmetrical framing, staged presentation, plain white background, sterile background, overly clean, artificial environment, waxy texture, plastic appearance, glossy finish, synthetic material, overly smooth, uniform texture, unrealistic rendering, perfect lighting, flat lighting, evenly lit, artificial gradients, digital highlights, unrealistic shadows, unrealistic light falloff, exaggerated depth of field, artificial blur, unrealistic bokeh, artificial focus effects, AI-generated appearance, CGI look, rendered image, digital enhancement, computer-generated, overly sharp edges, stock photo aesthetic, artificial perfection, hyper-polished, obvious AI, filter applied, edited appearance, color graded`

    // STEP 2: Image Generation with Gemini 2.5 Flash (free tier multimodal image output)
    const contextLines = [
      `Brand: ${brandName}`,
      `Description: ${brandDesc}`,
      `Brand voice: ${brandVoice}`,
      `Post topic: ${postTopic}`,
    ]
      .filter((line) => !line.endsWith(': '))
      .join('\n')

    const fullPrompt = `Elevate this product photo: enhance the visual presentation while preserving the authentic identity of the subject.

Product: ${productDetails}

${contextLines ? `\nBrand context:\n${contextLines}\n` : ''}
Direction: Create an elevated version that feels authentic, not artificial. Preserve the core visual identity—the colors, textures, and character of the product. Enhance lighting to be more flattering and dimensionally interesting. Refine the setting to feel more intentional and composed, but not sterile. Maintain a natural, food-forward aesthetic as if photographed by a skilled culinary photographer.

Composition: Candid but composed. Show the product in a way that invites engagement—not isolated, but situated naturally.

Lighting: Warm, directional, and dimensional. Soft enough to feel approachable, with enough definition to show texture and depth.

Setting: Natural surfaces (wood, stone, ceramic). Environmental context that suggests a real moment, not a studio setup.

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
