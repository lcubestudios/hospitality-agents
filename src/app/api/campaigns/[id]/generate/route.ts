import { NextRequest, NextResponse } from 'next/server'
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

    // Fetch campaign → brand
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('brand_id')
      .eq('id', campaignId)
      .single()

    const { data: brand } = campaign
      ? await supabase
          .from('brands')
          .select('name, description')
          .eq('id', campaign.brand_id)
          .single()
      : { data: null }

    const brandName = brand?.name ?? 'a food and beverage brand'
    const brandDesc = brand?.description ?? 'a food and beverage product'

    // STEP 1: Vision Analysis with Gemini 3 Flash
    let productDetails = ''
    if (uploadedImageUrl) {
      try {
        const imgRes = await fetch(uploadedImageUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          const base64Image = Buffer.from(imgBuffer).toString('base64')

          const visionRes = await fetch(
            `${BASE_URL}/models/gemini-3-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: 'Describe this product photo in detail. Focus on: what the product is, colors, textures, visible details, plating, garnishes, condition (fresh/cooked/prepared state). Be specific and vivid.',
                      },
                      {
                        inlineData: {
                          mimeType: 'image/jpeg',
                          data: base64Image,
                        },
                      },
                    ],
                  },
                ],
              }),
            },
          )

          if (visionRes.ok) {
            const visionData = await visionRes.json()
            productDetails = visionData.candidates?.[0]?.content?.parts?.[0]?.text || ''
          } else {
            console.warn('Vision analysis failed:', await visionRes.text())
          }
        }
      } catch (err) {
        console.warn('Vision analysis error, proceeding with generic prompt:', err)
      }
    }

    const negativePrompt = `studio lighting, product photography setup, isolated subject, plain white background, cutout look, perfectly centered composition, symmetrical framing, overly clean or sterile environment, staged presentation, waxy texture, plastic appearance, overly smooth surfaces, glossy or synthetic finish, uniform textures, unrealistic material rendering, perfect lighting, flat lighting, evenly lit scene, artificial gradients, digital highlights, unrealistic shadows, unrealistic light falloff, exaggerated depth of field, artificial blur, unrealistic bokeh, artificial focus effects, AI-generated appearance, CGI look, rendered image, digital enhancement, computer-generated, overly sharp edges, stock photo aesthetic, artificial perfection, hyper-polished`

    // STEP 2: Image Generation with Gemini 2.5 Flash (free tier multimodal image output)
    const fullPrompt = `Generate a high-quality product photo.

Product details: ${productDetails}

Style: Natural, 35mm lens, wooden table or stone countertop background, soft directional lighting, lived-in setting, candid composition.

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

    const imagePart = genData.candidates[0].content.parts.find(
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
