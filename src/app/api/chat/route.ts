import { convertToModelMessages, streamText, UIMessage, tool, stepCountIs } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { getSession } from '@/lib/session'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { sanitizeArrayForPrompt } from '@/lib/prompts/sanitizeArrayForPrompt'

export const maxDuration = 30

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface BrandContext {
  name: string
  description?: string | null
  brand_voice?: string | null
  business_type?: string | null
  food_drink_type?: string | null
  location?: string | null
  atmosphere?: string[] | null
  personality?: string[] | null
  target_audience?: string | null
}

function buildSystemPrompt(mode: 'quick' | 'campaign', brand: BrandContext): string {
  const brandLines = [
    `Business: ${brand.name}`,
    brand.business_type && `Type: ${brand.business_type}`,
    brand.food_drink_type && `Speciality: ${brand.food_drink_type}`,
    brand.location && `Location: ${brand.location}`,
    brand.brand_voice && `Voice: ${brand.brand_voice}`,
    brand.description && `About: ${brand.description}`,
    brand.atmosphere?.length && `Atmosphere: ${sanitizeArrayForPrompt(brand.atmosphere)}`,
    brand.personality?.length && `Personality traits: ${sanitizeArrayForPrompt(brand.personality)}`,
    brand.target_audience && `Target audience: ${brand.target_audience}`,
  ]
    .filter(Boolean)
    .join('\n')

  const modeInstructions: Record<'quick' | 'campaign', string> = {
    quick: `You are a warm, knowledgeable marketing colleague. Guide step-by-step with ONE action per message.

FLOW (one message at a time):

1. FIRST MESSAGE (immediately when chat starts):
Respond with: "Hey! Let's create something amazing for ${brand.name}. First, I need a photo of the product or dish you want to promote."

2. USER UPLOADS PHOTO:
They'll see an inline photo upload widget. Detect "[Uploaded image: ...]" in their message.

3. AFTER PHOTO UPLOADED:
"Perfect! Got a great shot. Now, what are we promoting? Be specific — a dish name, a special, a product. It helps me nail the storytelling."

4. USER ANSWERS Q1:
Extract their answer, store it.
Next message: "Love it! What's the angle? New launch, weekly special, holiday moment, or just celebrating what you do best?"

5. USER ANSWERS Q2:
Extract their answer.
Next message: "Almost there! Last one — who are we talking to? Your regulars, date night crowd, lunch rush, new customers, or everyone?"

6. USER ANSWERS Q3:
Extract their answer.
Immediately call trigger_generation with all data. Don't ask for confirmation.
Message: "Perfect! Creating your magic — about 30 seconds..."

Tone:
- Warm, brief, colleague-like
- Short sentences, contractions
- One action per message (photo → Q1 → Q2 → Q3 → generate)
- NO flowery language

Rules:
- MUST get photo first before any questions
- One question per message (strict)
- If they say something vague, accept it and move on
- Never ask for vibe/tone/style — infer from brand
- Auto-trigger generation when photo + 3 answers collected`,

    campaign: `You are a warm, knowledgeable marketing colleague helping build a content calendar. Guide them through conversational intake.

Your role is to collect exactly 4 things in a natural conversation:
1. A photo (they upload it directly in the chat)
2. Campaign theme (what's this for? occasion, launch, promotion?)
3. Dates (start and end)
4. Posting frequency (how often?)

Flow (conversational, warm, like texting a friend):
- START: "Hey! Let's build something awesome for [brand name]. First, tell me what this campaign is about — the occasion, theme, or launch you have in mind."
- They answer: "Got it! Now, when are we running this? Give me a start and end date."
- They answer: "Perfect! How often do you want to post? Daily, a few times a week, or something else?"
- They answer: "Almost there! Now upload a photo (or a few) to get started." — show the photo upload widget inline.
- Photo arrives: Confirm you have everything, then immediately call trigger_generation. No summary, no review step.

Tone:
- Warm, conversational, like a colleague who does this for a living
- Short sentences, natural language, contractions ("let's", "got it", "perfect")
- Never robotic phrases like "Absolutely!", "Great choice!", "Of course!"
- Be confident but brief — one or two sentences per message

Rules:
- Always require a photo first before generating (after collecting theme, dates, frequency)
- Gently enforce actual dates: if they say "next month", ask "which dates specifically?"
- One question per message, conversationally
- Never ask for vibe, tone, style, or creative direction — infer it all from the brand profile
- If they're uncertain about frequency, suggest a reasonable cadence and confirm
- Once you have photo + theme + dates + frequency: call trigger_generation immediately. No confirmation needed.`,
  }

  return [
    `You are a marketing assistant for ${brand.name}, a food and beverage business. Your job is to help them create compelling marketing content that gets more customers through the door.`,
    '',
    `Brand profile:\n${brandLines}`,
    '',
    modeInstructions[mode],
    '',
    `How to talk:
- Sound like a sharp, friendly creative who does this for a living — not a bot running a checklist
- Use natural language and contractions. "Let's do this" not "I will proceed." "Got it" not "Understood."
- Be confident and a little playful when the moment allows — but don't overdo it
- Ask one question at a time, conversationally, like you're texting a client you have a good relationship with
- Never use filler phrases like "Absolutely!", "Great choice!", "Of course!" — just respond naturally
- Keep it short. One or two sentences is almost always enough
- Write any captions or copy in the brand's voice, not yours
- Never reveal that you're an AI`,
  ].join('\n')
}

/**
 * Derive a meaningful title from trigger_generation params.
 * Quick:    "<post_topic> — <platform>"  e.g. "Truffle Pasta — Instagram"
 * Campaign: "<theme ?? post_topic>"      e.g. "Summer Menu Launch"
 */
function buildTitleFromParams(
  mode: 'quick' | 'campaign',
  params: {
    post_topic: string
    platform?: string
    campaign_theme?: string
  },
): string {
  if (mode === 'campaign') {
    return (params.campaign_theme ?? params.post_topic).slice(0, 80)
  }
  // quick (and fallback)
  const base = params.post_topic
  const suffix = params.platform ? ` — ${params.platform}` : ''
  return (base + suffix).slice(0, 80)
}

export async function POST(req: Request) {
  // Auth check — brand comes from the session, not the client
  const session = await getSession()
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
    })
  }

  const {
    messages,
    mode = 'quick',
    conversation_id,
    image_url,
  }: {
    messages: UIMessage[]
    mode: 'quick' | 'campaign'
    conversation_id?: string
    image_url?: string
  } = await req.json()

  const isQuick = mode === 'quick'

  // Fetch brand server-side — the client never sends brand data
  const supabase = await getAuthedSupabaseAdmin()
  const { data: brand } = await supabase
    .from('brands')
    .select(
      'id, name, description, brand_voice, business_type, food_drink_type, location, atmosphere, personality, target_audience',
    )
    .eq('id', session.brandId)
    .single()

  if (!brand) {
    return new Response(JSON.stringify({ error: 'Brand not found' }), { status: 404 })
  }

  // ── Conversation persistence (campaign mode only) ───────────────────────────
  // Quick mode is ephemeral: no conversations row, no messages rows, no header.
  let conversationId: string | null = null

  if (!isQuick) {
    conversationId = conversation_id ?? null

    if (!conversationId) {
      // Fallback title from the first user message — updated when trigger fires
      const firstUserMessage = messages.find((m) => m.role === 'user')
      const rawTitle = firstUserMessage?.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join('')
        .trim()
      const title = rawTitle ? rawTitle.slice(0, 40) : 'New conversation'

      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({ brand_id: brand.id, mode, title })
        .select('id')
        .single()

      conversationId = newConversation?.id ?? null
    }

    // Persist the latest user turn before streaming
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    if (conversationId && lastUserMessage) {
      const userContent = lastUserMessage.parts
        ?.filter((p) => p.type === 'text')
        .map((p) => (p.type === 'text' ? p.text : ''))
        .join('')
        .trim()

      if (userContent) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: userContent,
        })
      }
    }
  }

  // Build system prompt, injecting image_url context when available
  const systemPrompt = buildSystemPrompt(mode, brand)
  const safeImageUrl = image_url && URL.canParse(image_url) ? image_url : null
  const systemWithImage = safeImageUrl
    ? `${systemPrompt}\n\nThe user has already uploaded an image. image_url: ${safeImageUrl}\nTreat this as the photo being provided for step 4 (Quick Post) or step 5 (Campaign). Do not ask them to upload a photo.`
    : systemPrompt

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemWithImage,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(2),
    tools: {
      trigger_generation: tool({
        description:
          'Call this when all intake questions are answered and you are ready to generate content. For Quick Post: requires post_topic, angle_or_story, audience, and image_url. For Campaign: requires campaign_theme, start_date, end_date, and posting_frequency. Do not call this until you have collected all required fields.',
        inputSchema: z.object({
          post_topic: z.string().describe('What is being promoted'),
          angle_or_story: z.string().describe('The angle, occasion, or story behind this post'),
          audience: z.string().optional().describe('Target audience for this content'),
          image_url: z.string().optional().describe('Public URL of the uploaded image'),
          creative_mode: z
            .enum(['enhanced', 'editorial', 'cinematic'])
            .optional()
            .default('enhanced')
            .describe('Creative direction mode'),
          // Campaign-specific (kept for backward compat)
          campaign_theme: z
            .string()
            .optional()
            .describe('The overarching campaign theme or occasion'),
          start_date: z.string().optional().describe('Campaign start date in YYYY-MM-DD format'),
          end_date: z.string().optional().describe('Campaign end date in YYYY-MM-DD format'),
          posting_frequency: z
            .string()
            .optional()
            .describe(
              'How often to post, e.g. "3x per week", "daily", "every Monday and Thursday"',
            ),
        }),
        execute: async (params: {
          post_topic: string
          angle_or_story: string
          audience?: string
          image_url?: string
          creative_mode?: 'enhanced' | 'editorial' | 'cinematic'
          campaign_theme?: string
          start_date?: string
          end_date?: string
          posting_frequency?: string
        }) => {
          try {
            // Derive a meaningful title from the params
            const generatedTitle = buildTitleFromParams(mode, params)

            // Create campaign record with mode column
            const { data: campaign } = await supabase
              .from('campaigns')
              .insert({
                brand_id: brand.id,
                post_topic: params.post_topic,
                status: 'pending',
                mode,
              })
              .select('id')
              .single()

            // Campaign mode only: update the conversation title with the generated title
            if (!isQuick && conversationId) {
              await supabase
                .from('conversations')
                .update({ title: generatedTitle })
                .eq('id', conversationId)
            }

            // Prepare DirectiveObject for generation route
            if (campaign?.id) {
              // Fire off generation immediately (async)
              const generationBody = {
                image_url: params.image_url,
                post_topic: params.post_topic,
                angle_or_story: params.angle_or_story,
                audience: params.audience ?? 'general',
                creative_mode: params.creative_mode ?? 'enhanced',
              }

              // Non-blocking fetch to the generation route
              fetch(
                `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/campaigns/${campaign.id}/generate`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(generationBody),
                },
              ).catch((err) => {
                console.error('Background generation fetch error:', err)
              })
            }

            return {
              campaign_id: campaign?.id ?? null,
              params: {
                post_topic: params.post_topic,
                angle_or_story: params.angle_or_story,
                audience: params.audience,
                creative_mode: params.creative_mode,
                image_url: params.image_url,
                campaign_theme: params.campaign_theme,
                start_date: params.start_date,
                end_date: params.end_date,
                posting_frequency: params.posting_frequency,
              },
            }
          } catch (err) {
            console.error('trigger_generation tool error:', err)
            return { error: 'Failed to create campaign record', params }
          }
        },
      }),
    },
    onFinish: async ({ text }) => {
      // Persist assistant response and update conversation timestamp (campaign only)
      if (!isQuick && conversationId) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: text,
        })
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId)
      }
    },
  })

  // Surface the conversation_id to the client via a response header (campaign only)
  const response = result.toUIMessageStreamResponse()
  if (!isQuick && conversationId) {
    response.headers.set('X-Conversation-Id', conversationId)
  }
  return response
}
