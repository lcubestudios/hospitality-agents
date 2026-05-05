import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const { image_url: photoUrl } = await req.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ message: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const supabase = await getAuthedSupabaseAdmin()

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

    const brandName = brand?.name ?? 'our brand'
    const brandDesc = brand?.description ?? ''
    const brandVoice = brand?.brand_voice ?? ''
    const postTopic = campaign?.post_topic ?? 'a social media post'

    // Analyze uploaded photo for structured image context
    interface ImageContext {
      primary_subject: string
      subject_details: string
      environment: string
      lighting: string
      composition: string
      mood: string
      notable_elements: string
    }

    let imageContext: ImageContext = {
      primary_subject: '',
      subject_details: '',
      environment: '',
      lighting: '',
      composition: '',
      mood: '',
      notable_elements: '',
    }

    if (photoUrl) {
      try {
        const imgRes = await fetch(photoUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          const base64Image = Buffer.from(imgBuffer).toString('base64')

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
                    text: `Analyze this image and return a structured description of the scene.

Important:
Identify the primary subject of the image (typically the main dish, product, or focal item). All other elements should be described in relation to this subject.

Return the result in JSON with the following fields:

{
  "primary_subject": "The main focal item in the image (e.g., dish, drink, product)",
  "subject_details": "Key physical details of the subject such as color, texture, condition, and visible elements",
  "environment": "Surface, background, and surrounding context that supports the subject",
  "lighting": "Type, direction, intensity, and quality of light affecting the subject",
  "composition": "Framing, angle, positioning, and how the subject is emphasized",
  "mood": "Overall feeling or atmosphere conveyed by the image",
  "notable_elements": "Small but meaningful details that add realism or character"
}

Rules:
- The primary subject must be clear and specific
- Describe all other elements in relation to the subject
- Be concrete and observational, not abstract
- Avoid vague phrases like "nice lighting" or "beautiful scene"
- Do not infer anything not visible in the image
- Do not assume context, use, or backstory
- Do not make up details
- Keep each field concise but informative

Return ONLY valid JSON.`,
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
        console.warn('Photo analysis for caption failed, proceeding without:', err)
      }
    }

    const systemPrompt = [
      'You write Instagram captions for food and beverage brands. Your goal is to create captions that drive engagement and subtle action while feeling natural, human, and specific to the brand—not generic or overly promotional.',
      '',
      `Brand: ${brandName}`,
      `Description: ${brandDesc}`,
      '',
      'Voice directive:',
      `${brandVoice}`,
      '',
      'Interpret the voice directive and apply it consistently across:',
      '- word choice',
      '- sentence structure',
      '- punctuation',
      '- tone and attitude',
      '',
      'Do not describe the voice. Embody it.',
      '',
      'Image context:',
      `Subject: ${imageContext.primary_subject}`,
      `Subject details: ${imageContext.subject_details}`,
      `Mood and atmosphere: ${imageContext.mood}`,
      `Composition: ${imageContext.composition}`,
      '',
      'Context:',
      'Write the caption as if it reflects a real moment, setting, or feeling—not just a product description. Balance product presence with atmosphere depending on what feels natural.',
      '',
      'Perspective:',
      'Use a natural mix of brand voice, observational tone, or second-person where appropriate. Avoid rigid or repetitive structure.',
      '',
      'Rules:',
      '- Caption should be 3–5 sentences max',
      '- Write as if the brand is speaking directly to a real audience',
      '- Avoid aggressive or obvious promotion; persuasion should feel natural and embedded',
      '- Include a call to action when appropriate; occasionally allow a slightly more direct CTA if it fits the tone',
      '- Maintain consistency in tone throughout (no shifts)',
      '- Avoid repeating phrasing or sentence patterns commonly seen in AI-generated captions',
      '',
      'Natural language constraints:',
      '- Avoid overly polished or "perfect" phrasing',
      '- Slight irregularity and human rhythm is encouraged',
      '- Vary sentence length and structure',
      '- Avoid overused promotional phrases such as: "don\'t miss out", "now available", "perfect for", "you\'ll love", "come try", "best ever" unless they clearly align with the brand voice and feel natural in context',
      '- No emojis',
      '',
      'Output structure:',
      '- Optimize readability for Instagram (clean spacing, natural flow)',
      '- Avoid large dense blocks of text',
      '',
      'Output format:',
      'Return ONLY valid JSON in this exact shape: { "caption": "...", "hashtags": ["...", "..."] }',
      '',
      'Hashtags:',
      '- Include 10–15 hashtags',
      '- Include a balanced mix of: broad discovery tags (#food, #restaurant, etc.), niche/product-specific tags, visual or vibe-based tags, optional brand-specific tags',
      '- Avoid irrelevant or spammy hashtags',
      '- Avoid repeating the same hashtag set across generations',
      '',
      'No markdown. No explanation. Only JSON.',
    ].join('\n')

    const userMessage = `Write an Instagram caption for this post: ${postTopic}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const text = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
    const parsed = JSON.parse(text)

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('Caption generation error:', err)
    return NextResponse.json({ message: 'Caption generation failed' }, { status: 500 })
  }
}
