import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'
import { sanitizeArrayForPrompt } from '@/lib/sanitize'
import {
  OrchestrationContext,
  OrchestrationStep,
  GeneratedAsset,
  orchestrate,
} from '@/lib/generation-orchestrator'

export const maxDuration = 300

const GOOGLE_API_KEY = process.env.GOOGLE_AI_STUDIO_KEY
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

export type CreativeMode = 'enhanced' | 'editorial' | 'cinematic'
export type CampaignMode = 'social' | 'ads' | null

interface ShotDirection {
  shot_label: string
  concept: string
  food_styling: string
  set: string
  color_world: string
  lighting: string
  camera: string
  human_presence: 'none' | 'hands' | 'implied'
}

export interface CampaignStrategy {
  subject_description: string
  shots: ShotDirection[]
}

// ─── Utilities ────────────────────────────────────────────────────────────────

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

// ─── Step 1: Claude strategy prompt ──────────────────────────────────────────

function buildStrategyPrompt({
  brandName,
  brandVoice,
  brandProfile,
  postTopic,
  angleOrStory,
  audience,
}: {
  brandName: string
  brandVoice: string
  brandProfile: string
  postTopic: string
  angleOrStory: string
  audience: string
}): string {
  return `You are the creative direction team for ${brandName || 'this F&B brand'}. Your job: 4 distinct, visually STRIKING shot directions that feel like THIS BRAND. Not generic food content — content that belongs to this specific restaurant and no other.

BRAND IDENTITY (MUST INFORM EVERY DECISION):
${brandProfile ? brandProfile : 'Brand context: not specified'}
Brand voice: ${brandVoice || 'neutral'}

Study the food. Describe it with precision: exact textures, colors, details. This is the hero that carries through all 4 shots.

NOW — think BRAND IDENTITY. Every shot must feel like it belongs to ${brandName}.

Each shot is a BOLD, DESIGNED MOMENT that transforms the food into campaign-ready content while respecting this brand's identity. Think:
- Cheese pull caught mid-stretch at dramatic angle, smoke curling
- Ingredients elevated, scattered with intention, or arranged architecturally
- Backgrounds that match the brand's aesthetic AND read as intentional design — not casual, not snapshot
- Extreme angles, tight crops into textural detail, overhead geometry, close-ups that reveal
- Hands as compositional elements — holding, reaching, interacting with clear narrative
- Props as DESIGNED STATEMENTS — they don't just sit, they compose the frame
- Color palette that BELONGS to this brand but pushed for maximum visual impact
- Composition that feels like a creative director art-directed it — architectural, bold, not safe

4 visually DISTINCT ideas. Each a different creative concept. Each should feel like a professional food campaign shoot, not just "different angles of the dish."

CRITICAL DISTINCTION: The output must be OBVIOUSLY a campaign shoot:
- Styling that reads as intentional, not natural presentation
- Composition that shows design thinking — not just nice lighting
- Each shot has a clear visual concept that stops the scroll
- Props, arrangements, and details all feel chosen and purposeful

VISUAL COHERENCE AS A SET:
- All 4 share the brand's color foundation and material language
- BUT each shot is a completely different visual concept — different lighting approach, different compositional strategy, different styling moment
- Viewer sees all 4 and thinks: "This is clearly ${brandName}'s professional campaign. These are four DISTINCT creative directions for the same product."
- Not random shots. Not repetitive. A curated campaign.

VISUAL DIRECTION — GROUNDED IN BRAND:

Light: Modern food photography lighting that matches the brand's vibe. If ${brandName} is warm & intimate, use soft warm light. If modern & clean, use crisp directional light. The light should ENHANCE the brand's story and showcase the food.

Environment: Designed backgrounds that reflect the brand's personality and atmosphere. Not generic. NOT random pastels or trendy defaults. The set should feel like it belongs to ${brandName}'s world — their color palette, their materials, their design sensibility.

Composition: Dynamic and intentional. Can be tight crops, extreme angles, overhead, close detail shots. Architectural when it works; bold when it pops. But always cohesive with brand personality.

Color Palette: THIS IS CRITICAL. NOT a generic food photo palette. The color world should reflect the brand's identity, atmosphere, and personality traits listed above. Rich or minimal, warm or cool, saturated or natural — whatever fits ${brandName}. Saturation is OK if it matches the brand's aesthetic.

Props: Selective. When something is in frame, it reinforces the brand's story. Materials, finishes, and objects should feel at home in ${brandName}'s world.

Food Styling: Creative moments specific to this dish. Not just "here is the food." Think:
- A cheese pull mid-stretch
- Sauce dripping, pooling, running
- Ingredients scattered, arranged
- Steam or smoke visible
- A hand holding, dipping, interacting
- Close detail that shows quality
THE FOOD MUST BE WHOLE AND INTACT. Not bitten, not partial. Quantity matches input: one slice = one slice, one pizza = one pizza.

Human presence: Real and intentional. Hands when they add drama or story. Use them to show scale, action, interaction.

Zero text: No labels, signs, packaging text. If it's there in real life, face it away or exclude it.

Campaign topic: ${postTopic || 'not specified'}
${angleOrStory ? `Angle or story: ${angleOrStory}\n` : ''}${audience ? `Target audience: ${audience}\n` : ''}

Every shot must feel like it belongs to ${brandName}. This is not generic trendy food content. This is content that tells THIS brand's story.

Return ONLY valid JSON:

{
  "subject_description": "exact visual description of the food — what makes THIS specific item distinct. Crust char, sauce state, cheese melt, color, garnish, cut, texture. Precise enough to reproduce. CRITICAL: Describe the exact quantity shown in the input image. One slice = one slice. One pizza = one pizza. Do not add or remove items.",
  "shots": [
    {
      "shot_label": "2–4 word name",
      "concept": "the BOLD CREATIVE CAMPAIGN IDEA. What's the visual hook that stops the scroll? What's the designed moment? How does this reflect ${brandName}'s identity? Be specific about WHY this shot matters.",
      "food_styling": "SPECIFIC, INTENTIONAL styling action for a campaign shoot. Cheese pull at 45°. Sauce running mid-drip. Steam curling. Hand dramatically interacting. A detail magnified. Be VISUAL, DRAMATIC, and CLEAR about the action.",
      "set": "the DESIGNED environment that reflects ${brandName}'s aesthetic. Materials, colors, props — everything intentional and cohesive with the brand.",
      "color_world": "the color palette that belongs to ${brandName}. Not a generic food photo palette. Rich, minimal, warm, cool — whatever fits this brand's personality. Include specific color notes (warm terracottas, cool grays, bright citrus, deep earthy tones, etc.)",
      "lighting": "food photography lighting that matches ${brandName}'s vibe. Warm & intimate, or crisp & modern? Natural, designed studio, or something in between? What reveals the food AND the brand's personality?",
      "camera": "angle and crop that works for THIS shot AND this brand. Can be tight detail, extreme angle, overhead. Whatever serves both the design and the brand's visual language.",
      "human_presence": "none | hands | implied"
    }
  ]
}

- shots: exactly 4, each DISTINCT and VISUALLY STRIKING, and COHESIVE with each other
- subject_description: factual, precise
- human_presence: exactly one of "none", "hands", "implied"
- ALL DECISIONS MUST BE GROUNDED IN THE BRAND'S IDENTITY

Output ONLY valid JSON. No markdown. No explanation.`.trim()
}

// ─── Step 2: Per-shot Gemini image prompt ─────────────────────────────────────

function buildImagePrompt(
  shot: ShotDirection,
  subjectDescription: string,
  brandName: string,
): string {
  const humanPresenceBlock =
    shot.human_presence === 'hands'
      ? 'Hands in frame — a real person is holding, reaching for, or handling the food naturally. Hands look lived-in and real, not manicured or stock-photo perfect. No faces, no full figures.'
      : shot.human_presence === 'implied'
        ? 'Human presence implied only — a utensil resting mid-use, a portion already taken, a napkin pushed aside. No hands, no people visible. The evidence of someone is the story.'
        : 'No hands, no people. The food and its environment are the entire frame.'

  return `[BRAND & SUBJECT — NON-NEGOTIABLE]
You are creating content for ${brandName}. Every pixel must feel like it belongs to this brand.

The uploaded photo shows the exact food subject you are photographing. Study it.
These are the specific visual characteristics: ${subjectDescription}

Every one of these details must appear in your image. Do not substitute, generalise, or approximate. The subject described is exactly what you render — not a generic stand-in. The composition, angle, and setting change. The food does not.

Do NOT reproduce the reference photo's composition, framing, crop, or setting. Build an entirely new image per this brief. Only the food itself carries over.

[SHOT: ${shot.shot_label}]
Concept: ${shot.concept}

[FOOD STYLING]
${shot.food_styling}

[SET — BRAND COHERENCE CRITICAL]
${shot.set}

This environment must feel like it belongs to ${brandName}'s world. Not a generic food photo background. The materials, finishes, and spatial feel should all cohere with the brand's identity.

[COLOR PALETTE — BRAND ANCHORED]
${shot.color_world}

This is NOT a generic food photo palette. It is the visual language of ${brandName}. Every color choice must reinforce the brand's personality and atmosphere. Apply this palette throughout the entire image — backgrounds, props, lighting tones, and the food's interaction with light.

[LIGHT]
${shot.lighting}

[CAMERA]
${shot.camera}
Portrait/vertical orientation — 9:16, built for Instagram.

[PEOPLE]
${humanPresenceBlock}

[RENDER QUALITY]
PROFESSIONAL CAMPAIGN-READY PHOTOGRAPH for ${brandName}. This is ART-DIRECTED food photography, not a documentation shot. Shot with precision: perfect focus, rich natural colours, tactile textures, depth. Feels like a creative director and professional food photographer collaborated on this specific moment. The styling is INTENTIONAL. The composition is DESIGNED. This is high-end published campaign work that stops scrolls.

[VISUAL COHERENCE & CAMPAIGN IMPACT — APPLY TO EVERY PIXEL]
THIS IMAGE MUST FEEL LIKE IT BELONGS TO ${brandName.toUpperCase()} AND OBVIOUSLY BE CAMPAIGN WORK.

The entire image — set, colors, light, materials, mood, styling — must cohere into a single DESIGNED visual world that says: "This is a professional campaign for ${brandName}."

Professional food photography grounded in ${brandName}'s aesthetic AND elevated by intentional art direction. Light that feels native to the environment but DESIGNED for maximum visual impact — never artificial, never bland, never generic documentary feel.
Real materials with character — surfaces, textures, props — that reflect the brand's personality AND feel chosen, arranged, and styled with purpose. Never seamless backdrops. Never random. Everything is there because a creative director put it there.
Colour grading faithful to the color_world specified above AND pushed for visual richness. Rich or minimal, warm or cool, saturated or natural — whatever fits ${brandName}. Not desaturated, not trending filters. Feels like ${brandName}'s signature visual language elevated to campaign standard.
Architectural, BOLD composition — deliberate negative space, one unmistakable focal point, clean sightlines, strong geometry. Never busy, never cluttered, never competing focal points. The composition should READ as designed.
Maximum two or three intentional props total — every element earns its place, belongs to the brand, and contributes to the designed moment.

[ABSOLUTE HARD NO — ZERO TOLERANCE]
- Any text, letters, words, numbers anywhere — no labels, packaging, chalkboards, signs, stamps, or legible characters. Face away or exclude.
- Watermarks, copyright marks, stock photo artifacts
- Crumpled, folded, or used napkins or tissues
- Props not specified in the set brief — do not invent or add
- Busy or undesigned backgrounds
- Generic restaurant props (chalkboard menus, generic signage)
- Over-manicured or fake-looking hands — real only
- Stock photo aesthetic — artificial perfection, CGI sheen
- Warped or distorted food geometry
- Artificial glow, neon, lens flare, or HDR
- Surreal or non-photorealistic elements
- Multiple competing focal points
- A setting or atmosphere that could belong to ANY restaurant — it must feel specific to ${brandName}`.trim()
}

// ─── Gemini API call ──────────────────────────────────────────────────────────

async function generateImageWithGemini(
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Promise<Buffer | null> {
  const res = await fetch(
    `${BASE_URL}/models/gemini-3.1-flash-image:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              ...(imageBase64 ? [{ inline_data: { mime_type: mimeType, data: imageBase64 } }] : []),
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

  if (!res.ok) {
    const errText = await res.text()
    console.error(`Gemini generation error (${res.status}):`, errText)
    return null
  }

  const data = await res.json()

  if (!data.candidates?.[0]) {
    console.error('No candidates in Gemini response:', data)
    return null
  }

  const imagePart = data.candidates[0].content?.parts?.find(
    (part: { inlineData?: { mimeType?: string; data?: string } }) =>
      part.inlineData?.mimeType?.startsWith('image/'),
  )

  if (!imagePart?.inlineData?.data) {
    console.error(
      'No image data in Gemini response. Prompt may have been blocked by safety filters.',
    )
    return null
  }

  return Buffer.from(imagePart.inlineData.data, 'base64')
}

// ─── Quick Post: 4-shot strategy ─────────────────────────────────────────────

interface CampaignShot {
  title: string
  creative_direction: string
  lighting_approach: string
  setting_description: string
  human_presence: string
}

interface CampaignStrategy {
  shots: CampaignShot[]
}

function buildShotPrompt(
  shot: CampaignShot,
  subjectAnchor: string,
  brief: DirectorBrief,
  visualStyle?: VisualStyle,
): string {
  // Use the shot's lighting as the authoritative lighting directive
  const briefWithLighting: DirectorBrief = {
    ...brief,
    creative_direction: {
      ...brief.creative_direction,
      lighting_refinement: shot.lighting_approach || brief.creative_direction.lighting_refinement,
    },
  }
  const qualityLayer = buildQualityLayer(visualStyle, briefWithLighting)
  const humanBlock =
    shot.human_presence === 'none' ? 'No people or hands in frame.' : shot.human_presence

  return `[CREATIVE CONCEPT]
${shot.title}: ${shot.creative_direction}

[SUBJECT]
${subjectAnchor}

[SETTING & STAGING]
${shot.setting_description}

[HUMAN PRESENCE]
${humanBlock}

${qualityLayer}

[GUARDRAILS]
No warped food geometry. No glowing halos. No neon effects. No artificial saturation. No CGI look.
Organic, tactile surface grain. Natural saturation. True-to-life tones.
No text, overlays, watermarks, or logo placements.
Hands and human presence: follow the [HUMAN PRESENCE] block exactly — include what is described, exclude what is not.`
}

async function buildQuickPostStrategy(
  brandName: string,
  brandVoice: string,
  brandProfile: string,
  postTopic: string,
): Promise<CampaignStrategy> {
  const client = new Anthropic()
  const prompt = `You are a senior creative director briefing 4 completely independent creative teams on the same product. Each team works in a different visual world — different setting, different camera position, different story, different feeling. The 4 images should look like they came from 4 different campaigns.

Brand: ${brandName}
Brand voice: ${brandVoice}
Brand profile:
${brandProfile}

Product: ${postTopic}

The 4 structural archetypes below define what TYPE of shot each concept is. Within each archetype, you have full creative freedom — make art direction decisions that genuinely suit this brand, this product, and this moment.

ARCHETYPE 1 — STUDIO HERO
Type: Product alone, no environment. Seamless background, the product does all the talking.
Your job: Choose a background tone and staging that genuinely fits this brand's aesthetic. Decide what makes this product look magnetic in isolation. If a studio background structurally doesn't work for this product, swap for a minimalist single-surface shot instead.

ARCHETYPE 2 — MACRO DESIRE
Type: Extreme close-up. No setting — only the most irresistible detail of the product.
Your job: Identify the single most craveable visual moment — steam, drip, pull, pour, crust, condensation, cross-section. One hard light source reveals texture. Background falls to black or heavy blur.

ARCHETYPE 3 — LIFESTYLE IN CONTEXT
Type: Product in a real, fully styled environment. The scene has equal weight to the product.
Your job: Imagine the most aspirational real-world moment for this product. Make it specific and unexpected — not a generic café terrace.

ARCHETYPE 4 — OVERHEAD EDITORIAL
Type: Bird's-eye flat lay. Camera points straight down.
Your job: Choose a surface and props that tell a story. Not wooden restaurant table. Choose what actually suits this brand.

Return ONLY valid JSON:
{
  "shots": [
    {
      "title": "Studio Hero",
      "creative_direction": "your specific creative call — no brackets, no placeholders",
      "lighting_approach": "your lighting choice",
      "setting_description": "exactly what is in the frame",
      "human_presence": "none / or describe exactly"
    },
    {
      "title": "Macro Desire",
      "creative_direction": "the specific detail or moment that fills the frame",
      "lighting_approach": "your lighting choice",
      "setting_description": "what is visible beyond the extreme close-up, if anything",
      "human_presence": "none / or hands if directly part of the action"
    },
    {
      "title": "Lifestyle in Context",
      "creative_direction": "the scene, the story, why this moment for this brand",
      "lighting_approach": "the light that matches this setting",
      "setting_description": "specific place, surfaces, props, environmental elements",
      "human_presence": "describe any human presence"
    },
    {
      "title": "Overhead Editorial",
      "creative_direction": "the surface choice, the prop selection, the compositional logic",
      "lighting_approach": "soft overhead diffused light — any variations",
      "setting_description": "surface and every prop in the shot",
      "human_presence": "none"
    }
  ]
}

Output ONLY valid JSON. No markdown. No explanation. No placeholder text.`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const parsed = safeParseJson<CampaignStrategy>(raw)
    if (parsed?.shots?.length === 4) return parsed
  } catch (err) {
    console.warn('buildQuickPostStrategy failed, using fallback:', err)
  }

  return {
    shots: [
      {
        title: 'Studio Hero',
        creative_direction:
          "Product on a seamless background — the brand's palette, nothing competing for attention",
        lighting_approach:
          'Clean studio — large softbox fill, controlled soft shadow beneath product',
        setting_description: 'Seamless studio background, product elevated, no environment',
        human_presence: 'none',
      },
      {
        title: 'Macro Desire',
        creative_direction:
          'Extreme close-up on the most craveable detail — texture, steam, drip, or pour',
        lighting_approach:
          'Single hard directional light raking from one side — specular highlights on every edge',
        setting_description:
          'Extreme close-up — no setting visible, the detail fills the entire frame',
        human_presence: 'none',
      },
      {
        title: 'Lifestyle in Context',
        creative_direction:
          "The product in its most aspirational real-world moment — where it belongs, who it's for",
        lighting_approach: 'Natural light that matches the time and place',
        setting_description: 'A specific, fully-styled environment that tells the brand story',
        human_presence: 'Hands or body language that imply a real person enjoying this',
      },
      {
        title: 'Overhead Editorial',
        creative_direction:
          'Art-directed flat lay — product as hero, surface and props build the story',
        lighting_approach: 'Soft diffused overhead — even coverage, no directional shadows',
        setting_description:
          "Bird's-eye view on a distinctive surface surrounded by deliberate props",
        human_presence: 'none',
      },
    ],
  }
}

interface CampaignScheduleSlot {
  date: string
  platform: string
  content_brief: string
}

interface VisualLanguage {
  color_story: string
  lighting_character: string
  mood: string
}

interface CampaignScheduleResult {
  schedule: CampaignScheduleSlot[]
  visual_language: VisualLanguage
}

async function buildCampaignSchedule({
  brandName,
  brandVoice,
  brandProfile,
  postTopic,
  campaign_theme,
  start_date,
  end_date,
  posting_frequency,
}: {
  brandName: string
  brandVoice: string
  brandProfile: string
  postTopic: string
  campaign_theme: string
  start_date: string
  end_date: string
  posting_frequency: string
}): Promise<CampaignScheduleResult> {
  const fallback = (): CampaignScheduleResult => {
    const today = new Date()
    const slots: CampaignScheduleSlot[] = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + i * 7)
      return {
        date: d.toISOString().split('T')[0],
        platform: 'Instagram',
        content_brief: `Post ${i + 1} for ${campaign_theme || postTopic}: highlight a key aspect of this campaign.`,
      }
    })
    return {
      schedule: slots,
      visual_language: {
        color_story: 'Warm earthy tones with natural highlights',
        lighting_character: 'Soft diffused natural light with gentle shadows',
        mood: 'Inviting and authentic',
      },
    }
  }

  try {
    const client = new Anthropic()
    const prompt = `You are a social media content strategist for a food and beverage brand.

Brand: ${brandName}
Brand voice: ${brandVoice}
${brandProfile}
Campaign subject: ${postTopic}
Campaign theme: ${campaign_theme}
Campaign start: ${start_date}
Campaign end: ${end_date}
Posting frequency: ${posting_frequency}

Task: Generate a complete content schedule for this campaign.

1. Compute specific post dates between ${start_date} and ${end_date} at the given frequency (${posting_frequency}).
   - Cap at 20 slots maximum.
   - Distribute dates evenly across the campaign period.

2. For each date, write a content_brief (1-2 sentences) describing what this specific post should be about.
   - Each brief must be distinct from the others.
   - Together they should tell a coherent campaign story with a clear narrative arc (build anticipation → launch → sustain → close).
   - Ground each brief in the brand's actual food/drink offerings and the campaign theme.

3. Define a visual_language that unifies all posts:
   - color_story: The color palette and tonal direction (2-3 sentences)
   - lighting_character: The lighting approach (1-2 sentences)
   - mood: The emotional/atmospheric quality (1-2 sentences)

Return ONLY valid JSON in this exact shape:
{
  "schedule": [
    { "date": "YYYY-MM-DD", "platform": "Instagram", "content_brief": "..." }
  ],
  "visual_language": {
    "color_story": "...",
    "lighting_character": "...",
    "mood": "..."
  }
}

No markdown. No explanation. Only JSON.`

    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = res.content?.[0]?.type === 'text' ? res.content[0].text : ''
    const parsed = safeParseJson<CampaignScheduleResult>(raw)

    if (!parsed?.schedule?.length || !parsed?.visual_language) {
      console.warn('buildCampaignSchedule: invalid response, using fallback')
      return fallback()
    }

    // Enforce 20-slot cap
    return {
      ...parsed,
      schedule: parsed.schedule.slice(0, 20),
    }
  } catch (err) {
    console.warn('buildCampaignSchedule failed, using fallback:', err)
    return fallback()
  }
}

/**
 * Validates that tier resolution did not override the subject lock.
 * Detects if the resolved scene changed subject count, item composition, or introduced new elements.
 *
 * @param subjectLockForm - The original subject lock form (e.g., "single pasta portion")
 * @param resolvedScene - The resolved brief containing tier descriptions
 * @param tier - The creative mode used
 * @returns Validation result with boolean valid flag and optional warning message
 */
function validateSubjectLock(
  subjectLockForm: string,
  resolvedScene: DirectorBrief,
  tier: CreativeMode,
): { valid: boolean; warning?: string } {
  // Extract tier descriptions
  const tier1 = resolvedScene.tier_1_locked
  const tier2 = resolvedScene.tier_2_enhanced
  const tier3 = resolvedScene.tier_3_reimagined

  // Check: Tier 1 should reinforce the subject lock, not add new items
  const tier1Lower = tier1.toLowerCase()
  const formLower = subjectLockForm.toLowerCase()

  // Heuristics to detect subject override:
  // 1. Look for "add", "new", "additional", "introduce" in tier descriptions
  const additionKeywords = ['add ', 'new ', 'additional ', 'introduce ', 'added ', 'adds ']
  const containsAddition = [tier1Lower, tier2.toLowerCase(), tier3.toLowerCase()].some((text) =>
    additionKeywords.some((keyword) => text.includes(keyword)),
  )

  // 2. Check if tier 1 contradicts the lock (e.g., "locked" but then says something contradictory)
  if (!tier1Lower.includes(formLower) && formLower.length > 0 && tier === 'enhanced') {
    // For enhanced mode, tier 1 should reference the original subject
    return {
      valid: false,
      warning: `Tier 1 resolution may have changed subject. Expected reference to "${subjectLockForm}" but tier_1_locked: "${tier1}". This may indicate subject override during tier resolution.`,
    }
  }

  if (containsAddition && (tier === 'enhanced' || tier === 'editorial')) {
    return {
      valid: false,
      warning: `Subject override detected: tier resolution added new elements. Subject lock: "${subjectLockForm}". Retrying with subject lock reinforced.`,
    }
  }

  return { valid: true }
}

/**
 * Helper: Initialize orchestration context from request payload and campaign data.
 */
function initializeContext(
  campaignId: string,
  postTopic: string,
  payload: Record<string, unknown>,
): OrchestrationContext {
  return {
    campaignId,
    brandId: '', // will be filled before calling orchestrate
    postTopic,
    visualStyle: payload.visual_style as VisualStyle | undefined,
    metadata: {
      prompt_intent: payload.prompt_intent,
      photo_template: payload.photo_template,
      image_url: payload.image_url,
      chatMode: payload.chatMode,
      start_date: payload.start_date,
      end_date: payload.end_date,
      posting_frequency: payload.posting_frequency,
      campaign_theme: payload.campaign_theme,
    },
  }
}

/**
 * Build orchestration steps for campaign mode (scheduled posts).
 * Campaign mode generates a schedule and produces images for the first 4 slots.
 */
function buildCampaignSteps(
  payload: Record<string, unknown>,
  _ctx: OrchestrationContext,
  supabase: Awaited<ReturnType<typeof getAuthedSupabaseAdmin>>,
  sharedHelpers: SharedGenerationHelpers,
): OrchestrationStep[] {
  return [
    {
      name: 'vision',
      execute: (ctx) => sharedVisionStep(ctx, supabase, sharedHelpers),
    },
    {
      name: 'strategy',
      execute: (ctx) => campaignStrategyStep(ctx, payload),
    },
    {
      name: 'generation',
      execute: (ctx) => campaignGenerationStep(ctx, payload, supabase, sharedHelpers),
    },
    {
      name: 'upload',
      execute: (ctx) => uploadStep(ctx, supabase),
    },
  ]
}

/**
 * Build orchestration steps for quick-post mode (4 creative concepts).
 * Quick post mode generates 4 distinct shot concepts without a schedule.
 */
function buildQuickPostSteps(
  payload: Record<string, unknown>,
  _ctx: OrchestrationContext,
  supabase: Awaited<ReturnType<typeof getAuthedSupabaseAdmin>>,
  sharedHelpers: SharedGenerationHelpers,
): OrchestrationStep[] {
  return [
    {
      name: 'vision',
      execute: (ctx) => sharedVisionStep(ctx, supabase, sharedHelpers),
    },
    {
      name: 'strategy',
      execute: (ctx) => quickPostStrategyStep(ctx),
    },
    {
      name: 'generation',
      execute: (ctx) => quickPostGenerationStep(ctx, payload, supabase, sharedHelpers),
    },
    {
      name: 'upload',
      execute: (ctx) => uploadStep(ctx, supabase),
    },
  ]
}

/**
 * Shared context between all step executors.
 * Holds references to Supabase, campaign brand info, and image generation helpers.
 */
interface SharedGenerationHelpers {
  brandName: string
  brandVoice: string
  brandProfile: string
  uploadedImageUrl?: string
  uploadedBase64: string
  uploadedMimeType: string
}

/**
 * SHARED STEP: Vision analysis (Director's Brief)
 * Runs Vision + analysis to produce a resolved scene (brief).
 */
async function sharedVisionStep(
  ctx: OrchestrationContext,
  _supabase: Awaited<ReturnType<typeof getAuthedSupabaseAdmin>>,
  helpers: SharedGenerationHelpers,
): Promise<OrchestrationContext> {
  let brief: DirectorBrief = buildFallbackBrief(ctx.postTopic || '', ctx.visualStyle)

  if (helpers.uploadedImageUrl) {
    try {
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
                  media_type: helpers.uploadedMimeType as
                    | 'image/jpeg'
                    | 'image/png'
                    | 'image/gif'
                    | 'image/webp',
                  data: helpers.uploadedBase64,
                },
              },
              {
                type: 'text',
                text: buildVisionPrompt({
                  brandName: helpers.brandName,
                  brandVoice: helpers.brandVoice,
                  brandProfile: helpers.brandProfile,
                  postTopic: ctx.postTopic || '',
                  visualStyle: ctx.visualStyle,
                  promptIntent: ctx.metadata?.prompt_intent as string | undefined,
                }),
              },
            ],
          },
        ],
      })

      const raw = visionRes.content?.[0]?.type === 'text' ? visionRes.content[0].text : ''
      const parsed = safeParseJson<DirectorBrief>(raw)
      if (parsed?.hero_label) {
        brief = parsed
      }
    } catch (err) {
      console.warn('Vision analysis failed, using fallback brief:', err)
    }
  }

  const validation = validateSubjectLock(
    (ctx.postTopic || brief.hero_label).trim(),
    brief,
    ctx.visualStyle?.creative_mode || 'enhanced',
  )
  if (!validation.valid) {
    console.warn(`Subject lock validation failed: ${validation.warning}`)
  }

  return {
    ...ctx,
    briefFromVision: brief,
  }
}

/**
 * CAMPAIGN-SPECIFIC STEP: Strategy (schedule generation)
 * Produces a campaign schedule with visual language guidelines.
 */
async function campaignStrategyStep(
  ctx: OrchestrationContext,
  payload: Record<string, unknown>,
): Promise<OrchestrationContext> {
  const theme = (payload.campaign_theme as string) || ctx.postTopic || ''
  const { schedule, visual_language } = await buildCampaignSchedule({
    brandName: (ctx.metadata?.brandName as string) || '',
    brandVoice: (ctx.metadata?.brandVoice as string) || '',
    brandProfile: (ctx.metadata?.brandProfile as string) || '',
    postTopic: ctx.postTopic || '',
    campaign_theme: theme,
    start_date: (payload.start_date as string) || '',
    end_date: (payload.end_date as string) || '',
    posting_frequency: (payload.posting_frequency as string) || '',
  })

  return {
    ...ctx,
    schedule,
    visual_language,
  }
}

/**
 * QUICK-POST-SPECIFIC STEP: Strategy (4-shot concept generation)
 * Produces 4 creative shot concepts without a schedule.
 */
async function quickPostStrategyStep(ctx: OrchestrationContext): Promise<OrchestrationContext> {
  const strategy = await buildQuickPostStrategy(
    (ctx.metadata?.brandName as string) || '',
    (ctx.metadata?.brandVoice as string) || '',
    (ctx.metadata?.brandProfile as string) || '',
    ctx.postTopic || '',
  )

  return {
    ...ctx,
    metadata: {
      ...ctx.metadata,
      strategy,
    },
  }
}

/**
 * CAMPAIGN-SPECIFIC STEP: Generation (image generation per schedule slot)
 * Generates 4 images in parallel, one per first 4 schedule slots.
 * Updates campaign_schedule rows with asset_id and status.
 */
async function campaignGenerationStep(
  ctx: OrchestrationContext,
  payload: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof getAuthedSupabaseAdmin>>,
  helpers: SharedGenerationHelpers,
): Promise<OrchestrationContext> {
  if (!ctx.schedule || !ctx.briefFromVision) {
    throw new Error('campaignGenerationStep: missing schedule or brief from prior steps')
  }

  const brandIdForSchedule = ctx.brandId

  // Insert all schedule rows first
  const scheduleRows = ctx.schedule.map((slot) => ({
    campaign_id: ctx.campaignId,
    brand_id: brandIdForSchedule,
    scheduled_date: slot.date,
    platform: slot.platform || 'Instagram',
    content_brief: slot.content_brief,
    status: 'pending' as const,
  }))

  const { data: insertedRows, error: scheduleInsertError } = await supabase
    .from('campaign_schedule')
    .insert(scheduleRows)
    .select('id, scheduled_date, content_brief, platform')

  if (scheduleInsertError) {
    console.error('Failed to insert campaign_schedule rows:', scheduleInsertError.message)
  }

  const firstFourSlots = (insertedRows ?? []).slice(0, 4)
  const firstFourSchedule = ctx.schedule.slice(0, 4)

  const visualContext = [
    `Color story: ${ctx.visual_language?.color_story}`,
    `Lighting: ${ctx.visual_language?.lighting_character}`,
    `Mood: ${ctx.visual_language?.mood}`,
  ].join('\n')

  const subjectAnchor = ctx.postTopic || ctx.briefFromVision.hero_label

  // Generate 4 images in parallel
  const assetResults = await Promise.all(
    firstFourSchedule.map(async (slot, i) => {
      const slotPrompt = buildGeminiPrompt({
        brief: {
          ...ctx.briefFromVision!,
          image_final_prompt: `${slot.content_brief} ${ctx.briefFromVision!.image_final_prompt}`,
        },
        subjectAnchor,
        visualStyle: ctx.visualStyle,
        promptIntent: `${slot.content_brief}\n\n[VISUAL LANGUAGE — apply consistently across all posts in this campaign]\n${visualContext}`,
        photoTemplate: payload.photo_template as string | undefined,
      })

      const slotStoragePath = `${ctx.campaignId}/schedule-${i + 1}.jpg`
      const result = await generateAndUploadImage(
        slotPrompt,
        slotStoragePath,
        ctx.campaignId,
        supabase,
        helpers,
        true, // skipAssetInsert for now, we'll update schedule instead
      )

      // Update schedule row with asset_id and status
      if (result && result.asset && firstFourSlots[i]) {
        await supabase
          .from('campaign_schedule')
          .update({ asset_id: result.asset.id, status: 'completed' })
          .eq('id', firstFourSlots[i].id)
      } else if (firstFourSlots[i]) {
        await supabase
          .from('campaign_schedule')
          .update({ status: 'failed' })
          .eq('id', firstFourSlots[i].id)
      }

      return result
    }),
  )

  const assets: GeneratedAsset[] = assetResults.filter(
    (a): a is { asset_url: string; asset?: { id: string; asset_url: string } } => a !== null,
  )

  return {
    ...ctx,
    assets,
  }
}

/**
 * QUICK-POST-SPECIFIC STEP: Generation (4 distinct creative concepts)
 * Generates 4 images in parallel, one per shot concept.
 * Does NOT insert into campaign_schedule.
 */
async function quickPostGenerationStep(
  ctx: OrchestrationContext,
  _payload: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof getAuthedSupabaseAdmin>>,
  helpers: SharedGenerationHelpers,
): Promise<OrchestrationContext> {
  if (!ctx.briefFromVision || !ctx.metadata?.strategy) {
    throw new Error('quickPostGenerationStep: missing brief or strategy from prior steps')
  }

  const subjectAnchor = ctx.postTopic || ctx.briefFromVision.hero_label
  const strategy = ctx.metadata.strategy as Awaited<ReturnType<typeof buildQuickPostStrategy>>

  const shotPrompts = strategy.shots.map((shot) =>
    buildShotPrompt(shot, subjectAnchor, ctx.briefFromVision!, ctx.visualStyle),
  )

  const shotResults = await Promise.allSettled(
    shotPrompts.map((prompt, i) =>
      generateAndUploadImage(
        prompt,
        `${ctx.campaignId}/shot-${i + 1}.jpg`,
        ctx.campaignId,
        supabase,
        helpers,
        true, // skipAssetInsert = true for quick-post
      ),
    ),
  )

  const assets = shotResults
    .filter(
      (r): r is PromiseFulfilledResult<{ asset_url: string } | null> => r.status === 'fulfilled',
    )
    .map((r) => r.value)
    .filter(Boolean) as Array<{ asset_url: string }>

  if (assets.length === 0) {
    throw new Error('All image generations failed')
  }

  return {
    ...ctx,
    assets,
  }
}

/**
 * SHARED STEP: Upload finalization
 * Currently a no-op (images are uploaded during generation step).
 * Placeholder for future video upload, manifest generation, etc.
 */
async function uploadStep(
  ctx: OrchestrationContext,
  _supabase: Awaited<ReturnType<typeof getAuthedSupabaseAdmin>>,
): Promise<OrchestrationContext> {
  // All uploads happen inline during generation.
  // This step is a placeholder for future finalization logic.
  return ctx
}

/**
 * Helper: generate one image from a Gemini prompt and upload to Supabase.
 * Called by both campaign and quick-post generation steps.
 */
async function generateAndUploadImage(
  geminiPrompt: string,
  storagePath: string,
  campaignId: string,
  supabase: Awaited<ReturnType<typeof getAuthedSupabaseAdmin>>,
  helpers: SharedGenerationHelpers,
  skipAssetInsert = false,
): Promise<{ asset_url: string; asset?: { id: string; asset_url: string } } | null> {
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
              ...(helpers.uploadedBase64
                ? [
                    {
                      inline_data: {
                        mime_type: helpers.uploadedMimeType,
                        data: helpers.uploadedBase64,
                      },
                    },
                  ]
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
    console.error(`Gemini generation error (${genRes.status}) for ${storagePath}:`, errText)
    return null
  }

  const genData = await genRes.json()

  const imagePart = genData.candidates?.[0]?.content?.parts?.find(
    (part: { inlineData?: { mimeType?: string; data?: string } }) =>
      part.inlineData?.mimeType?.startsWith('image/'),
  )

  if (!imagePart?.inlineData?.data) {
    console.error(`No image data for ${storagePath}. May have been blocked by safety filters.`)
    return null
  }

  const generatedBuffer = Buffer.from(imagePart.inlineData.data, 'base64')

  const { error: uploadError } = await supabase.storage
    .from('campaign-uploads')
    .upload(storagePath, generatedBuffer, { contentType: 'image/jpeg', upsert: true })

  if (uploadError) {
    console.error(`Storage upload error for ${storagePath}:`, uploadError.message)
    return null
  }

  const { data: publicUrlData } = supabase.storage
    .from('campaign-uploads')
    .getPublicUrl(storagePath)

  const assetUrl = publicUrlData.publicUrl

  if (skipAssetInsert) return { asset_url: assetUrl }

  const { data: asset, error: assetError } = await supabase
    .from('assets')
    .insert({ campaign_id: campaignId, asset_type: 'image', asset_url: assetUrl })
    .select('id, asset_url')
    .single()

  if (assetError || !asset) {
    console.error(`Asset insert error for ${storagePath}:`, assetError?.message)
    return null
  }

  return { asset_url: assetUrl, asset }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const payload = await req.json()

    if (!GOOGLE_API_KEY) {
      return NextResponse.json({ message: 'GOOGLE_AI_STUDIO_KEY not configured' }, { status: 500 })
    }

    const supabase = await getAuthedSupabaseAdmin()
    await supabase.from('campaigns').update({ status: 'generating' }).eq('id', campaignId)

    // Load brand and campaign data
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('brand_id, post_topic')
      .eq('id', campaignId)
      .single()

    const postTopic = directivePostTopic ?? campaign?.post_topic ?? ''

    const { data: brand } = campaign
      ? await supabase
          .from('brands')
          .select(
            'name, location, description, brand_voice, business_type, food_drink_type, atmosphere, personality',
          )
          .eq('id', campaign.brand_id)
          .single()
      : { data: null }

    const brandName = brand?.name ?? ''
    const brandVoice = brand_voice_override || brand?.brand_voice || ''

    const brandProfileLines = [
      brand?.business_type && `Venue type: ${brand.business_type}`,
      brand?.food_drink_type && `Food & drink focus: ${brand.food_drink_type}`,
      brand?.atmosphere?.length && `Atmosphere: ${sanitizeArrayForPrompt(brand.atmosphere, 5)}`,
      brand?.personality?.length && `Personality: ${sanitizeArrayForPrompt(brand.personality, 5)}`,
    ].filter(Boolean)
    const brandProfile = brandProfileLines.join('\n')

    // Prepare uploaded image data
    let uploadedBase64 = ''
    let uploadedMimeType = 'image/jpeg'
    const uploadedImageUrl = payload.image_url as string | undefined

    if (uploadedImageUrl) {
      try {
        const imgRes = await fetch(uploadedImageUrl)
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer()
          uploadedBase64 = Buffer.from(imgBuffer).toString('base64')
          uploadedMimeType = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
        }
      } catch (err) {
        console.warn('Failed to fetch uploaded image:', err)
      }
    }

    // Initialize orchestration context
    const ctx: OrchestrationContext = initializeContext(campaignId, postTopic, payload)
    ctx.brandId = campaign?.brand_id ?? ''
    ctx.metadata = {
      ...ctx.metadata,
      brandName,
      brandVoice,
      brandProfile,
    }

    // Shared helpers for generation steps
    const helpers: SharedGenerationHelpers = {
      brandName,
      brandVoice,
      brandProfile,
      uploadedImageUrl,
      uploadedBase64,
      uploadedMimeType,
    }

    // Determine execution path and build steps
    const chatMode = payload.chatMode as string | undefined
    const hasScheduleFields = payload.start_date && payload.end_date && payload.posting_frequency
    const isCampaignMode = chatMode === 'campaign' && hasScheduleFields

    const steps: OrchestrationStep[] = isCampaignMode
      ? buildCampaignSteps(payload, ctx, supabase, helpers)
      : buildQuickPostSteps(payload, ctx, supabase, helpers)

    // Orchestrate with logging callbacks
    const finalCtx = await orchestrate(steps, ctx, {
      beforeStep: async (step, _context) => {
        console.log(`→ Starting step: ${step}`)
      },
      afterStep: async (step, _context) => {
        console.log(`✓ Completed step: ${step}`)
      },
      onStepError: async (step, error) => {
        console.error(`✗ Step ${step} failed: ${error.message}`)
      },
    })

    // Prepare response
    const brief = finalCtx.briefFromVision
    const assets = finalCtx.assets || []

    if (assets.length === 0) {
      await supabase.from('campaigns').update({ status: 'failed' }).eq('id', campaignId)
      return NextResponse.json({ message: 'No assets generated' }, { status: 500 })
    }

    await supabase.from('campaigns').update({ status: 'completed' }).eq('id', campaignId)

    // Campaign vs quick-post response formats
    if (isCampaignMode) {
      return NextResponse.json({
        assets,
        schedule_count: finalCtx.schedule?.length ?? 0,
        generated_count: assets.length,
        director_brief: brief,
        visual_language: finalCtx.visual_language,
      })
    }

    return NextResponse.json({
      assets,
      director_brief: brief,
    })
  } catch (err) {
    console.error('Generation error:', err)
    return NextResponse.json({ message: 'Generation failed' }, { status: 500 })
  }
}
