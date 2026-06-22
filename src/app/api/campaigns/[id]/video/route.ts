import { NextRequest, NextResponse } from 'next/server'
import { Anthropic } from '@anthropic-ai/sdk'
import { getAuthedSupabaseAdmin } from '@/lib/supabase/db'

// ─── Legacy types (kept here for video route self-sufficiency) ────────────────

type CreativeMode = 'enhanced' | 'editorial' | 'cinematic'

interface VisualStyle {
  mood?: string
  lighting?: string
  shot_type?: string
  color_palette?: string
  time_of_day?: string
  creative_mode?: CreativeMode
}

interface DirectorBrief {
  hero_label: string
  dish_shape: 'tall' | 'wide'
  camera_angle: string
  background_subject: string
  tier_1_locked: string
  tier_2_enhanced: string
  tier_3_reimagined: string
  creative_direction: {
    lighting_refinement: string
    lens_intent: string
    texture_notes: string
    color_grade: string
  }
  kinetic_script: {
    camera_vector: string
    parallax_priority: string
    secondary_motion: string
  }
  image_final_prompt: string
  video_final_prompt: string
}

function buildFallbackBrief(postTopic: string, visualStyle?: VisualStyle): DirectorBrief {
  const subject = postTopic || 'food subject'
  const moodAtmo = [visualStyle?.mood, visualStyle?.time_of_day].filter(Boolean).join(', ')
  return {
    hero_label: subject,
    dish_shape: 'wide',
    camera_angle: 'Three-quarter overhead, classic food editorial',
    background_subject: 'surface or environment',
    tier_1_locked: `${subject} geometry, ingredient placement, plating structure, and background surface identity are fixed. No additions, no deletions.`,
    tier_2_enhanced:
      'Refine existing lighting with specular highlights and soft shadow roll-off. Enhance surface textures and optical depth.',
    tier_3_reimagined: moodAtmo
      ? `Re-grade background tonal mood to achieve a ${moodAtmo} atmosphere. Add subtle atmospheric depth. Keep visible scene recognizable.`
      : 'Re-grade background tonal mood for premium editorial feel. Add subtle atmospheric depth. Keep visible scene recognizable.',
    creative_direction: {
      lighting_refinement:
        "Low-Key Chiaroscuro. Rim-lighting from 10 o'clock. Specular highlights on surface. Crushed shadow roll-off.",
      lens_intent:
        'Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background bokeh.',
      texture_notes: 'Specular highlights, surface grain, tactile material quality.',
      color_grade:
        'Commercial Editorial Grade — Warm, True-to-Life Tones, Zero Oversaturation, Crushed Blacks in the Shadows.',
    },
    kinetic_script: {
      camera_vector:
        'Lateral Tracking Shot (Sideways Slide), 4 inches left to right. High Frame-Rate Cinematic Drift.',
      parallax_priority:
        'Prioritize background parallax separation — foreground faster than background, maximum 3D depth.',
      secondary_motion: 'none',
    },
    image_final_prompt: `Professional commercial reshoot of ${subject}. Tier 1 locked. Tier 2 lighting refinement with specular highlights. Tier 3 editorial color grade.`,
    video_final_prompt: `${subject} master footage. Horizontal camera displacement, 4-inch slide. Tier 1 locked. Tier 2 lighting refined. Tier 3 atmosphere re-graded. Natural parallax.`,
  }
}

function buildVisionPrompt({
  brandName,
  brandVoice,
  postTopic,
  promptIntent,
}: {
  brandName: string
  brandVoice: string
  postTopic: string
  visualStyle?: VisualStyle
  promptIntent?: string
}): string {
  return `You are a professional cinematographer and creative director analyzing an uploaded food or drink photo for a premium campaign video.

Brand: ${brandName || 'not specified'}
Brand voice: ${brandVoice || 'not specified'}
Post topic: ${postTopic || 'not specified'}
${promptIntent ? `\n[TEMPLATE DIRECTIVE]\n${promptIntent}\n` : ''}
Return ONLY valid JSON in this exact shape:

{
  "hero_label": "",
  "dish_shape": "",
  "camera_angle": "",
  "background_subject": "",
  "tier_1_locked": "",
  "tier_2_enhanced": "",
  "tier_3_reimagined": "",
  "creative_direction": {
    "lighting_refinement": "",
    "lens_intent": "",
    "texture_notes": "",
    "color_grade": ""
  },
  "kinetic_script": {
    "camera_vector": "",
    "parallax_priority": "",
    "secondary_motion": ""
  },
  "image_final_prompt": "",
  "video_final_prompt": ""
}

Output ONLY valid JSON. No markdown. No explanation.`.trim()
}

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
  visualStyle,
  promptIntent,
  videoTemplate,
}: {
  brief: DirectorBrief
  subjectAnchor: string
  visualStyle?: VisualStyle
  promptIntent?: string
  videoTemplate?: string
}): string {
  const templateDirective = promptIntent
    ? `[TEMPLATE DIRECTIVE]\n${promptIntent}\nThis directive defines the motion behavior and camera intent. All other instructions serve it.\n\n`
    : ''

  const mode = visualStyle?.creative_mode

  const sharedGuardrails = `[GUARDRAILS]
Zero Typography. The frame must be 100% free of all characters, subtitles, watermarks, scripts, lower-thirds, logo overlays, and digital artifacts. Silent. No audio.
No added hands. No added people. No change to item count. No altered plating. No new objects.
No glowing halos. No neon effects. No CGI look. No warped food geometry.
Movement is physical camera movement only. The scene must remain empty of all camera equipment, vehicles, production tools, and crew.`

  // Per-template motion branches
  if (videoTemplate === 'slow-reveal') {
    return `${templateDirective}[MOTION GOAL]
The dish is not visible at the start. The camera gradually reveals it, building anticipation. The reveal is the emotional peak.
Food subject: ${subjectAnchor}

[CAMERA BEHAVIOR]
Begin with the dish obscured: low angle tight on a textural detail, behind a foreground element, or a close crop of the surface.
Move slowly and deliberately to reveal the full hero dish.
The reveal moment — when the dish is first fully visible — is the emotional climax of the clip.

[SPEED & TIMING]
Extremely slow, deliberate. The reveal should feel like unwrapping something precious.
Complete the full reveal by the 4-second mark. Final frame: clean, beautiful composition of the hero.
Format: 9:16 portrait.

[SCENE]
Dish is the subject. The starting obscured position and the reveal path define the drama.
Atmospheric elements permitted if physically plausible from the dish: light steam from a hot dish.

${sharedGuardrails}
No flash cuts. Single continuous reveal motion.
Dish geometry locked once revealed — no changes post-reveal.
Fixed focal length. No zoom. No pan or tilt. The reveal is through camera translation only.

Directive: ${brief.video_final_prompt} Slow reveal — build from obscured to the full hero reveal.
Goal: 9:16 vertical, 4–5 seconds.`
  }

  if (videoTemplate === 'top-down-pan') {
    return `${templateDirective}[MOTION GOAL]
An overhead editorial descent or lateral sweep across the food arrangement. The camera travels through the composition from above.
Food subject: ${subjectAnchor}

[CAMERA BEHAVIOR]
Strictly overhead perspective. Camera moves either:
- Vertically (slow editorial descent downward toward the spread), OR
- Laterally (a smooth horizontal sweep across the flat-lay composition)
The motion allows each element of the spread to enter the frame in a deliberate sequence.

[SPEED & TIMING]
Controlled, unhurried. Magazine editorial pace. Confident.
Complete the full motion story by the 4-second mark.
Format: 9:16 portrait.

[SCENE]
Overhead flat-lay composition visible throughout. All food items on a unified surface.
Motion reveals the arrangement in a deliberate, editorial sequence.

${sharedGuardrails}
Strictly overhead — no angle changes, no tilts. Pure overhead translation or descent.
No zoom. Fixed focal length. The spread remains in frame throughout.

Directive: ${brief.video_final_prompt} Top-down pan — overhead editorial sweep across the food arrangement.
Goal: 9:16 vertical, 4–5 seconds.`
  }

  if (videoTemplate === 'ambient-motion') {
    return `${templateDirective}[MOTION GOAL]
Near-static camera. The motion comes from within the scene — the camera is a witness, not a performer.
Food subject: ${subjectAnchor}

[CAMERA BEHAVIOR]
Camera is essentially still — imperceptible micro-movement or completely static.
All visual interest comes from in-scene atmospheric motion: rising steam, condensation, gentle garnish movement, subtle light shift.

[SPEED & TIMING]
Extremely slow, patient. The scene breathes.
Atmospheric motion continues naturally throughout the full clip.
Format: 9:16 portrait.

[SCENE]
The dish and its atmospheric elements are the entire story.
Atmospheric motion must be physically plausible from the dish type:
- Hot dishes: rising steam, light shimmer in air above the surface
- Cold drinks: condensation forming or slowly sliding
- Garnish: herbs, leaves, toppings with subtle natural movement
- Light: soft ambient glint off a reflective surface
One or two atmospheric elements maximum — not a weather event.

${sharedGuardrails}
Camera movement imperceptible or completely absent.
No theatrical camera motion. No reveals. No lateral passes.
Atmospheric elements must be physically plausible — not invented or excessive.

Directive: ${brief.video_final_prompt} Ambient motion — static camera, the scene itself is alive.
Goal: 9:16 vertical, 4–5 seconds.`
  }

  if (videoTemplate === 'side-pass') {
    return `${templateDirective}[MOTION GOAL]
The camera travels laterally past the dish. The dish stays fixed; the camera moves through a world.
Food subject: ${subjectAnchor}

[CAMERA BEHAVIOR]
Pure lateral tracking shot. Camera moves from one side to the other at a consistent, smooth speed.
The dish is introduced from one edge of the frame, moves through center-frame, and the motion continues to the opposite edge.
Background parallax creates dimensional depth — foreground moves faster than background.

[SPEED & TIMING]
Smooth, cinematic film pace. Not too fast (not a drive-by), not too slow (not a static drift).
The dish occupies center frame at the midpoint of the clip.
Complete the full lateral pass by the 4-second mark. Format: 9:16 portrait.

[SCENE]
The dish on its surface. Background provides depth through parallax separation.
Secondary motion permitted: subtle atmospheric elements that move within the scene.

${sharedGuardrails}
Purely lateral — no vertical component. No angle changes. Fixed focal length. No zoom.
The surface and dish geometry remain static. Only the camera translates.

Directive: ${brief.video_final_prompt} Side pass — camera travels laterally through the world the dish inhabits.
Goal: 9:16 vertical, 4–5 seconds.`
  }

  if (videoTemplate === 'loop') {
    return `${templateDirective}[MOTION GOAL]
A perfectly seamless, hypnotic loop. The clip plays forward and could play backward — the cut is invisible.
Food subject: ${subjectAnchor}

[CAMERA BEHAVIOR]
A motion that reads identically forward and backward:
- A slow vertical descent that reverses as a rise, OR
- A minimal lateral drift that returns to origin, OR
- A slow push-in that reverses as a pull-back
The motion must complete a full cycle or be reversible with no visible cut.

[SPEED & TIMING]
Extremely slow. The motion is barely perceptible in real time. Hypnotic, not dramatic.
The loop cut must be invisible — the final frame must connect visually to the first frame.
Format: 9:16 portrait.

[SCENE]
The dish and its setting. Atmospheric elements should also loop naturally:
- Steam that rises and dissipates in the same cadence
- Condensation that builds subtly, not dramatically
- Light that shifts and returns
Avoid directional atmospheric motion that does not read backward.

${sharedGuardrails}
The motion must work in reverse — no reveals, no directional "entering" shots.
Minimal atmospheric — only elements that feel natural in both directions.
No zoom. Fixed focal length.

Directive: ${brief.video_final_prompt} Seamless loop — motion cycles invisibly, hypnotic and still.
Goal: 9:16 vertical, 4–5 seconds.`
  }

  if (videoTemplate === 'dining-moment') {
    return `${templateDirective}[MOTION GOAL]
The dish alive in a dining context — the full table scene, ambient and social, as if witnessed in real life.
Food subject: ${subjectAnchor}

[CAMERA BEHAVIOR]
A gentle environmental pull-back or subtle lateral move that allows the dining setting to breathe.
The table setting and ambient context are visible. The camera moves as a participant, not a studio operator.
Motion is gentle — social energy, real life pace, not a commercial shoot.

[SPEED & TIMING]
Gentle, unhurried. The pace of someone noticing something beautiful at dinner.
Complete the full motion story by the 4-second mark. Format: 9:16 portrait.

[SCENE]
The dish in the context of a real dining moment:
- Table surface, ambient setting, environmental elements visible
- Utensils, napkin, secondary food elements as already present in the scene
- Environmental light: window light, ambient warm light, candlelight glow
Atmospheric motion: gentle steam, subtle condensation, soft ambient light movement.
No lifestyle props added that were not in the source scene. No hands. No people.

${sharedGuardrails}
No lifestyle props added beyond what is already in the source scene.
No theatrical camera motion. No reveals. No side passes.
The dining context comes from the environment and arrangement — not from added staging.

Directive: ${brief.video_final_prompt} Dining moment — the dish alive in its natural social context.
Goal: 9:16 vertical, 4–5 seconds.`
  }

  if (mode === 'enhanced') {
    return `${templateDirective}[PRODUCTION TIER]
Camera: ARRI Alexa Mini LF, 100mm f/2.8 Macro. Cinematic 4K. Natural highlight rolloff. True color response. Vertical 9:16 Studio Format.

[SCENE — FULLY LOCKED]
${brief.tier_1_locked}
Hero anchor: ${subjectAnchor}
Perspective: ${brief.camera_angle}. Preserve exactly throughout. No reframing.
Surface, background, plating, garnish, item count: identical to source.
Original light direction: preserved. Only intensity and balance refined.

[RETOUCHER PASS IN MOTION]
${brief.tier_2_enhanced}
Lighting: ${brief.creative_direction.lighting_refinement} — applied to the existing direction, not replacing it.
Reconstruct specular highlights with physical accuracy. Recover shadow detail without flattening contrast.
Surface micro-texture rendered with material accuracy.
Texture: ${brief.creative_direction.texture_notes}
Optical subject/background separation through real depth-of-field falloff.

[MOTION — OBSERVATIONAL RESTRAINT]
Camera Vector: ${brief.kinetic_script.camera_vector}
Parallax: ${brief.kinetic_script.parallax_priority}
Secondary Motion: ${brief.kinetic_script.secondary_motion}
Speed: Slow, controlled, observational — professional food-show B-roll energy. Never theatrical.
Start: Begin stable for the first beats, then introduce motion naturally. No fade-ins.
Geometry: Dish base geometry remains 100% static. Movement is purely camera-based.
Timing: Complete the full motion story by the 4-second mark.
Framing: Hero stays inside center 70% safe zone throughout.
Format: 9:16 portrait.

${sharedGuardrails}
Fixed focal length. No zoom. No pan. No tilt. No orbit. No dolly-in. No push-pull.
No added drama, no mood shift, no atmospheric elements (no new steam, condensation, particles) that were not in the source.
Preserve only the textures already visible in the source image.

Directive: ${brief.video_final_prompt} Master-retoucher finish in motion. Faithful to the original scene.
Goal: 9:16 vertical, 4–5 seconds.`.trim()
  }

  if (mode === 'editorial') {
    return `${templateDirective}[PRODUCTION TIER]
Camera: ARRI Alexa Mini LF, 85mm f/1.4. Cinematic 4K. Magazine editorial production. Vertical 9:16 Format.

[DISH IDENTITY — PRESERVED, RE-PLATED]
Food subject: ${subjectAnchor}. Same dish, recognizable as the same product — but freshly re-plated by a food stylist. Garnish redone, drizzles re-styled, composition re-arranged on the plate.

[SET — COMPLETELY REDESIGNED]
A new surface chosen for this dish — marble, slate, weathered oak, linen, brushed stone.
A new lighting design with a deliberate creative stance: moody chiaroscuro, bright airy daylight, golden raking light, or cool minimalist — driven by the aesthetic choice.
A strong cohesive color world.
${brief.tier_3_reimagined}
Color: ${brief.creative_direction.color_grade}
Subtle styling elements only (linen napkin, single utensil, oil drizzle). NO lifestyle narrative props (no wine glass, no companion plate, no candles).

[SUBTLE ATMOSPHERIC]
Subtle motion in the air is permitted if it serves the dish: light steam from a hot subject, soft condensation drift on cold glass, gentle herb flutter, oil drizzle catching light.
No full atmospheric narrative. Restraint with intent.

[MOTION — CHOREOGRAPHED]
Camera Vector: ${brief.kinetic_script.camera_vector}
Parallax: ${brief.kinetic_script.parallax_priority}
Secondary Motion: ${brief.kinetic_script.secondary_motion}
Speed: Designed and deliberate. Movement choreographed to serve the aesthetic — every frame feels art-directed.
Pace: Magazine-feature tempo. Confident, considered.
Timing: Complete the full motion story by the 4-second mark.
Framing: Hero unmistakable. Composition serves the editorial identity.
Format: 9:16 portrait.

${sharedGuardrails}

Directive: ${brief.video_final_prompt} Magazine-stylist reshoot in motion — same dish, distinct visual identity.
Goal: 9:16 vertical, 4–5 seconds.`.trim()
  }

  if (mode === 'cinematic') {
    return `${templateDirective}[PRODUCTION TIER]
Camera: ARRI Alexa Mini LF, 50mm f/1.2. Cinematic 4K. Full campaign production. Vertical 9:16 Format.

[DISH IDENTITY — PRESERVED]
Food subject: ${subjectAnchor}. The dish remains recognizable as the same product. It may be re-plated to suit the scene composition.

[SCENE — FULLY STAGED]
Build a complete bespoke environment around this dish: a chosen narrative location (restaurant interior, sunlit terrace, moody bar, marble kitchen counter, candlelit dinner table, weathered street-food cart).
${brief.tier_3_reimagined}

[LIFESTYLE STAGING]
Complementary props belong in the frame: a glass of wine or cocktail beside the dish, a companion plate in soft background focus, ambient cutlery, napkins, table dressing, candles, contextual accents (espresso beside dessert, herbs and oils near pasta, lemon near seafood).
Every prop earns its place — narrative, not clutter. Multi-subject framing — hero unmistakable, supporting elements add context.

[ATMOSPHERIC STORYTELLING IN MOTION]
The air has texture and movement. Rising steam from hot food. Drifting smoke from a grill. Light condensation drops on cold glass. Window light shifting subtly. Candle flicker. Ambient particles caught in raking light. These atmospheric elements live in the world — they move naturally, not as overlays.

[LIGHTING & GRADE]
${brief.creative_direction.color_grade}
Cinematic lighting designed for the scene. Direction, color temperature, falloff, atmosphere all serve the campaign mood.

[MOTION — NARRATIVE CINEMATOGRAPHY]
Camera Vector: ${brief.kinetic_script.camera_vector}
Parallax: ${brief.kinetic_script.parallax_priority}
Secondary Motion: ${brief.kinetic_script.secondary_motion}
Speed: Cinematic and deliberate. Camera motion reveals or builds the scene. TV-commercial pace.
Atmospheric motion (steam drift, particles, light shifts) is encouraged — belongs to the scene, not added in post.
Timing: Complete the full motion story by the 4-second mark.
Framing: Hero dish prominent within the staged scene. Lifestyle props supporting in the frame.
Format: 9:16 portrait.

[GUARDRAILS]
Zero Typography. The frame must be 100% free of all characters, subtitles, watermarks, scripts, lower-thirds, logo overlays, and digital artifacts. Silent. No audio.
No added hands. No added people in frame. No warped food geometry. No CGI feel.
The dish must remain recognizable as the original product.
Movement is physical — camera motion and natural in-world motion only.

Directive: ${brief.video_final_prompt} Bespoke campaign in motion — full lifestyle scene around the dish.
Goal: 9:16 vertical, 4–5 seconds.`.trim()
  }

  // Default — restrained three-tier (no mode selected)
  return `${templateDirective}[PRODUCTION TIER]
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

${sharedGuardrails}
Fixed 100mm focal length. Zero lens magnification changes. No zoom. No pan. No tilt. No orbit. No dolly-in. No push-pull.
Render all surfaces with organic, tactile grain. Use soft shadow roll-off and physics-based specular highlights only.
Preserve only the textures already visible in the source image. Do not generate additional food texture, garnish texture, moisture, crumbs, or surface detail.

Directive: ${brief.video_final_prompt}
Goal: 9:16 vertical, 4–5 seconds.`.trim()
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await params
    const {
      image_url: imageUrl,
      director_brief: incomingBrief,
      visual_style: visualStyle,
      prompt_intent: promptIntent,
      video_template: videoTemplate,
    } = await req.json()

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
    const vs: VisualStyle | undefined = visualStyle
    let brief: DirectorBrief = incomingBrief ?? buildFallbackBrief(postTopic, vs)
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
                      text: buildVisionPrompt({
                        brandName,
                        brandVoice,
                        postTopic,
                        visualStyle: vs,
                        promptIntent,
                      }),
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
      visualStyle: vs,
      promptIntent,
      videoTemplate,
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
