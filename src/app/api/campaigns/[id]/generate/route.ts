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

export interface VisualStyle {
  mood?: string
  lighting?: string
  shot_type?: string
  color_palette?: string
  time_of_day?: string
  creative_mode?: CreativeMode
}

function mapLighting(lighting: string): string {
  switch (lighting) {
    case 'Natural daylight':
      return 'Soft diffused window light. Clean bright highlights. Minimal shadows.'
    case 'Golden hour':
      return 'Warm directional raking light from 45°. Amber color temperature. Long soft shadows.'
    case 'Moody/low-lit':
      return "Low-Key Chiaroscuro. Rim-lighting from 10 o'clock. Deep shadow roll-off. Crushed blacks."
    case 'Studio bright':
      return 'Clean even commercial lighting. No visible shadows. Maximum product clarity.'
    default:
      return lighting
  }
}

function mapColorPalette(palette: string): string {
  switch (palette) {
    case 'Earthy & neutral':
      return 'Warm earthy editorial grade — natural tones, organic texture, crushed blacks in shadows.'
    case 'Cool & minimal':
      return 'Clean cool editorial grade — desaturated highlights, crisp whites, minimal color cast.'
    case 'Rich & saturated':
      return 'Rich editorial grade — deep saturated tones, high contrast, vivid but true-to-life.'
    case 'Dark & moody':
      return 'Dark editorial grade — low-key tones, crushed blacks, dramatic chiaroscuro.'
    default:
      return 'Commercial Editorial Grade — Warm, True-to-Life Tones, Zero Oversaturation, Crushed Blacks in the Shadows.'
  }
}

export interface DirectorBrief {
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

export function buildFallbackBrief(postTopic: string, visualStyle?: VisualStyle): DirectorBrief {
  const subject = postTopic || 'food subject'
  const lighting = visualStyle?.lighting
    ? mapLighting(visualStyle.lighting)
    : "Low-Key Chiaroscuro. Rim-lighting from 10 o'clock. Specular highlights on surface. Crushed shadow roll-off."
  const colorGrade = visualStyle?.color_palette
    ? mapColorPalette(visualStyle.color_palette)
    : 'Commercial Editorial Grade — Warm, True-to-Life Tones, Zero Oversaturation, Crushed Blacks in the Shadows.'
  const moodAtmo = [visualStyle?.mood, visualStyle?.time_of_day].filter(Boolean).join(', ')
  return {
    hero_label: subject,
    dish_shape: 'wide',
    camera_angle:
      visualStyle?.shot_type === 'Overhead flat lay'
        ? 'Top-down flat lay'
        : visualStyle?.shot_type === 'Close-up detail'
          ? 'Close-up macro, straight-on'
          : 'Three-quarter overhead, classic food editorial',
    background_subject: 'surface or environment',
    tier_1_locked: `${subject} geometry, ingredient placement, plating structure, and background surface identity are fixed. No additions, no deletions.`,
    tier_2_enhanced:
      'Refine existing lighting with specular highlights and soft shadow roll-off. Enhance surface textures and optical depth.',
    tier_3_reimagined: moodAtmo
      ? `Re-grade background tonal mood to achieve a ${moodAtmo} atmosphere. Add subtle atmospheric depth. Keep visible scene recognizable.`
      : 'Re-grade background tonal mood for premium editorial feel. Add subtle atmospheric depth. Keep visible scene recognizable.',
    creative_direction: {
      lighting_refinement: lighting,
      lens_intent:
        'Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background bokeh.',
      texture_notes: 'Specular highlights, surface grain, tactile material quality.',
      color_grade: colorGrade,
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

export function buildVisionPrompt({
  brandName,
  brandVoice,
  brandProfile,
  postTopic,
  visualStyle,
  promptIntent,
}: {
  brandName: string
  brandVoice: string
  brandProfile?: string
  postTopic: string
  visualStyle?: VisualStyle
  promptIntent?: string
}): string {
  const styleLines = [
    visualStyle?.mood && `- Mood: ${visualStyle.mood}`,
    visualStyle?.lighting && `- Lighting: ${visualStyle.lighting}`,
    visualStyle?.shot_type && `- Shot type: ${visualStyle.shot_type}`,
    visualStyle?.color_palette && `- Color palette: ${visualStyle.color_palette}`,
    visualStyle?.time_of_day && `- Time of day: ${visualStyle.time_of_day}`,
  ].filter(Boolean)
  const styleBlock = styleLines.length
    ? `\nUser style preferences (bias your creative direction toward these):\n${styleLines.join('\n')}\n`
    : ''

  const templateBlock = promptIntent
    ? `\n[TEMPLATE DIRECTIVE]\nThe target composition for this shoot: ${promptIntent}\nShape the Director's Brief — especially camera_angle, kinetic_script, and all three tier descriptions — to serve this template intent.\n`
    : ''

  const mode = visualStyle?.creative_mode
  const modeBlock =
    mode === 'cinematic'
      ? `\nCreative mode: CINEMATIC. This is a bespoke brand campaign — the dish is the hero of a fully staged narrative scene built around it. Keep the dish recognizable as the same product; it may be re-plated to suit the scene. Build a complete world: a chosen environment (restaurant interior, sunlit terrace, moody bar, kitchen at golden hour, candlelit table, weathered street cart, etc.) AND lifestyle props that tell a story (a glass of wine or cocktail beside the dish, a companion plate in soft background focus, ambient cutlery, table dressing, candles, contextual accents) AND atmospheric storytelling (rising steam, candle flicker, drifting smoke, streaming window light, ambient particles in raking light). TV-commercial-grade scene, not a food photo.\n`
      : mode === 'editorial'
        ? `\nCreative mode: EDITORIAL. This is a magazine stylist reshoot. The dish identity is preserved (a burger remains that burger, a pasta remains that pasta) but a food stylist has re-plated it from scratch — garnish redone, sauce drizzles re-styled, herbs replaced, composition re-arranged on the plate. The setting is completely redesigned: a new surface (marble, slate, weathered oak, linen, brushed concrete — chosen to serve the aesthetic), a new lighting design with a deliberate creative stance, a new cohesive color world, magazine-quality composition. Subtle styling elements are acceptable (linen napkin, single utensil, oil drizzle) but NO lifestyle narrative props (no wine glass, no companion plate). The result must be an obviously distinct reshoot — not a filter, not a refinement.\n`
        : mode === 'enhanced'
          ? `\nCreative mode: ENHANCED. This is a high-end retoucher pass — the level of work a master retoucher applies to a RAW file before publication. Scene is LOCKED: same surface, same background, same composition, same plating, same garnish, same item count, same light direction. The improvement is technical, not creative: physically accurate re-lighting that preserves direction but fixes balance, reconstructed specular highlights, recovered shadow detail without flattening contrast, true optical subject/background separation, surface micro-texture rendered with material accuracy, corrected white balance and color casts, atmospheric depth between hero and background. Do NOT add drama, mood shifts, atmospheric elements, or stylization that were not present in the original. The result is the same photo, finished beyond what phone editing can produce.\n`
          : ''

  const profileBlock = brandProfile ? `\n${brandProfile}` : ''

  return `You are a professional cinematographer and creative director analyzing an uploaded food or drink photo for a premium Instagram campaign reshoot.

Brand: ${brandName || 'not specified'}
Brand voice: ${brandVoice || 'not specified'}${profileBlock}
Post topic: ${postTopic || 'not specified'}${templateBlock}${modeBlock}${styleBlock}

Your job is to create a Director's Brief for downstream image and video generation.

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

Rules:

hero_label:
- 1–3 word plain dish/drink name.

dish_shape:
- Classify as exactly one of:
  - "tall" for burgers, cocktails, shakes, stacked desserts, vertical items
  - "wide" for bowls, tacos, steaks, plates, platters, flat dishes, spread dishes

camera_angle:
- Faithfully describe the input photo perspective.
- Do not invent a new angle.

background_subject:
- 2–5 words describing what the background physically is.
- No quality adjectives.
- Examples: "wood table", "stone countertop", "restaurant booth", "plain wall", "metal tray"

tier_1_locked:
- Food geometry, item count, ingredient placement, plating structure, and visible background identity are locked.
- State exactly what must not change.
- Do not allow new dishes, drinks, utensils, props, hands, people, or expanded table settings.

tier_2_enhanced:
- Existing lighting quality, surface texture, optical depth, and dimensionality may be refined.
- Use language like lighting refinement, specular highlights, tactile grain, soft shadow roll-off.
- Do not replace the dish, plating, or background identity.

tier_3_reimagined:
- Background grade, tonal mood, atmospheric depth, and subtle effects may be creatively improved.
- Keep the visible background identity recognizable.
- Atmosphere may evolve, but the scene must not become a different place.

creative_direction.lighting_refinement:
- Assess the existing light and subject position. Prescribe refinement toward Low-Key Chiaroscuro or Rim-lighting from an appropriate angle (e.g., 10–2 o'clock range) based on observed geometry.
- Use physics-based terms: chiaroscuro, rim light, color temperature, specular highlights, crushed shadow roll-off.
- Do not use: dramatic, glow, redesign, neon, surreal.

creative_direction.lens_intent:
- Always return exactly: "Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background bokeh."

creative_direction.texture_notes:
- Use sensory surface language based on the visible subject.
- Mention only visible or physically plausible details such as condensation, glaze sheen, char, steam, crisp edges, oil sheen, moisture, matte grain.

creative_direction.color_grade:
- Always return exactly: "Commercial Editorial Grade — Warm, True-to-Life Tones, Zero Oversaturation, Crushed Blacks in the Shadows."

kinetic_script.camera_vector:
- Choose based on dish_shape.
- If dish_shape is "tall": return "Vertical Jib Rise, 4 inches upward from plate level. High Frame-Rate Cinematic Drift."
- If dish_shape is "wide": return "Lateral Tracking Shot (Sideways Slide), 4 inches left to right. High Frame-Rate Cinematic Drift."
- No pan. No tilt. No orbit. No zoom. No push toward subject. No push-pull.

kinetic_script.parallax_priority:
- Always return: "Prioritize background parallax separation — foreground faster than background, maximum 3D depth."
- Keep the hero subject within the center 70% of the 9:16 frame.

kinetic_script.secondary_motion:
- Physically implied motion only.
- Examples: rising steam, condensation drift, slight garnish movement.
- If none is visible or plausible, return "none."

image_final_prompt:
- 2–3 terse declarative sentences for Gemini.
- Reference the three tiers.
- No kinematic language.

video_final_prompt:
- 2–3 terse declarative sentences for Veo.
- Use physical cinematography terms only: "master footage," "cinematic plate," "editorial render," "camera displacement."
- Reference the three tiers and selected camera vector.
- Never use: "commercial," "ad," "campaign," "reel," "promo," "social media," or any brand/marketing language.

Output ONLY valid JSON.
No markdown.
No explanation.`.trim()
}

function buildQualityLayer(visualStyle?: VisualStyle, brief?: DirectorBrief): string {
  const mode = visualStyle?.creative_mode
  const lightingLine = visualStyle?.lighting
    ? mapLighting(visualStyle.lighting)
    : (brief?.creative_direction.lighting_refinement ??
      "Low-Key Chiaroscuro. Rim-lighting from 10 o'clock. Specular highlights on surface.")
  const colorLine = visualStyle?.color_palette
    ? mapColorPalette(visualStyle.color_palette)
    : (brief?.creative_direction.color_grade ??
      'Commercial Editorial Grade — Warm, True-to-Life Tones, Zero Oversaturation, Crushed Blacks in the Shadows.')
  const moodAtmo = [visualStyle?.mood, visualStyle?.time_of_day].filter(Boolean).join(', ')

  if (mode === 'enhanced') {
    return `[QUALITY — RETOUCHER PASS]
Master retoucher level. Scene locked — no reframing, no new props, no added elements.
Lighting: ${lightingLine} Preserve existing direction. Fix intensity and balance only.
Reconstruct specular highlights on glossy surfaces. Recover shadow detail without flattening contrast.
Surface micro-texture rendered with material accuracy: wood grain, ceramic glaze, food char, condensation as already present.
Optical depth through real depth-of-field falloff. Color: correct white balance, restore true-to-life food tones. ${colorLine}
No mood shift. No new atmospheric elements. Same photo, finished to a level phone editing cannot reach.`
  }
  if (mode === 'editorial') {
    return `[QUALITY — MAGAZINE EDITORIAL]
Magazine-stylist-level production. Lighting is a deliberate creative stance.
Lighting design: ${lightingLine}
${moodAtmo ? `Target atmosphere: ${moodAtmo}.` : ''}
Color: ${colorLine} A strong cohesive color world with a single identifiable aesthetic.
Lens: Simulated full-frame sensor, 100mm f/1.4 Macro. Subject tack-sharp. Creamy magazine depth.`
  }
  if (mode === 'cinematic') {
    return `[QUALITY — CAMPAIGN PRODUCTION]
Bespoke brand campaign. Cinema-grade production.
Lighting: ${lightingLine} Designed from scratch for the scene.
Color: ${colorLine}
${moodAtmo ? `Target atmosphere: ${moodAtmo}.` : ''}
Lens: Simulated cinema sensor, 50mm f/1.2. Film-quality still.`
  }
  return `[QUALITY — COMMERCIAL EDITORIAL]
Camera: Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background: creamy bokeh.
Lighting: ${lightingLine}
Color: ${colorLine}
${moodAtmo ? `Target atmosphere: ${moodAtmo}.` : ''}
Premium commercial food editorial. Billboard quality.`
}

function buildGeminiPrompt({
  brief,
  subjectAnchor,
  visualStyle,
  promptIntent,
  photoTemplate,
}: {
  brief: DirectorBrief
  subjectAnchor: string
  visualStyle?: VisualStyle
  promptIntent?: string
  photoTemplate?: string
}): string {
  const templateDirective = promptIntent
    ? `[TEMPLATE DIRECTIVE]\n${promptIntent}\nThis directive defines the composition, framing, and shot goal. All other instructions serve it.\n\n`
    : ''

  const qualityLayer = buildQualityLayer(visualStyle, brief)
  const mode = visualStyle?.creative_mode
  const lightingLine = visualStyle?.lighting
    ? mapLighting(visualStyle.lighting)
    : brief.creative_direction.lighting_refinement
  const colorLine = visualStyle?.color_palette
    ? mapColorPalette(visualStyle.color_palette)
    : brief.creative_direction.color_grade
  const moodAtmo = [visualStyle?.mood, visualStyle?.time_of_day].filter(Boolean).join(', ')

  // Per-template full prompt branches — template defines composition/framing; quality layer from mode
  if (photoTemplate === 'hero-close-up') {
    return `${templateDirective}[SHOT GOAL]
Maximum intimacy with the hero dish. Fill the frame — the food itself is the entire world.
Food subject: ${subjectAnchor}

[DISH GEOMETRY — LOCKED]
The food arrangement from the reference photo is preserved. Do not rearrange, restage, or add plating elements not in the original.
What changes: framing tightens, depth of field deepens, lighting sharpens. The food itself does not change.

[COMPOSITION]
Framing: Tight three-quarter overhead or straight-on. Dish fills 80%+ of the frame. Background compressed by lens.
Focal point: One dominant element — the most texturally rich part of the dish. Everything else serves it.
Rule: Centered or rule-of-thirds anchor. No empty table real estate visible.

[IN FRAME]
The dish only — primary garnish, sauce detail, and surface texture fully visible.
No secondary elements. No table setting. No lifestyle props.

[FRAMING RULES]
No wide shot. No table scene. The environment disappears — only food.
Background compressed to creamy bokeh. Dish geometry fills frame without crowding.

${qualityLayer}

[GUARDRAILS]
No lifestyle props. No wine glasses, no cutlery unless already plated. No hands.
The dish is the only subject. No environment beyond the immediate plate or bowl.
No warped food geometry. No surreal elements. No text or overlays.

Directive: ${brief.image_final_prompt} Hero close-up — maximum intimacy, food fills the frame. Dish arrangement locked.`
  }

  if (photoTemplate === 'top-down-spread') {
    return `${templateDirective}[SHOT GOAL]
Overhead editorial spread — multiple elements arranged as a deliberate composition that fills the frame.
Food subject: ${subjectAnchor} as hero, with supporting items creating the spread.

[COMPOSITION]
Framing: Direct overhead, flat lay. All items on a unified surface. No foreshortening.
Layout: Hero dish larger and anchored at center or upper-center. Supporting items create a surrounding composition.
Negative space used intentionally. Grid, scatter, or radial pattern with editorial intent.

[IN FRAME]
Primary dish as hero plus supporting food elements: sauces, sides, garnish, accompanying items.
All items on a unified surface. Surface texture visible and deliberate.

[FRAMING RULES]
Strictly overhead — no angle. All items fully visible, nothing cropped by the frame.
The arrangement must read as intentional editorial styling, not random placement.

${qualityLayer}

[GUARDRAILS]
Only food-relevant items in the spread. No lifestyle props (no wine glasses, no non-food cutlery).
No hands. No people. No text or overlays. No warped food geometry.
Items must feel deliberately placed, not algorithmically scattered.

Directive: ${brief.image_final_prompt} Top-down editorial spread — hero anchored in a deliberate food arrangement.`
  }

  if (photoTemplate === 'in-setting') {
    return `${templateDirective}[SHOT GOAL]
The dish within its natural environment. Setting tells the story — where this food lives.
Food subject: ${subjectAnchor}

[COMPOSITION]
Framing: Three-quarter angle or slight perspective. The dish is always primary — the setting is always secondary.
Depth: Dish sharp in foreground or center-frame. Setting provides environmental narrative in the background.
${moodAtmo ? `Environment atmosphere: ${moodAtmo}.` : ''}

[IN FRAME]
Hero dish in the foreground or center.
Visible setting context: table surface, ambient background, environmental elements.
Setting is recognizable but never dominates the frame.

[FRAMING RULES]
Dish occupies the primary compositional weight. Setting fills the frame without competing.
Natural environment — no overly styled or artificial staging.

${qualityLayer}

[GUARDRAILS]
No added lifestyle staging props (no wine glasses placed in, no candles added if not present).
No hands. No people. No text or overlays.
The environment is contextual, not cinematic production design.
No warped food geometry.

Directive: ${brief.image_final_prompt} In-setting — dish as hero in its natural environment.`
  }

  if (photoTemplate === 'editorial-plate') {
    return `${templateDirective}[SHOT GOAL]
Editorial photography of the dish as-is — same food, elevated to magazine quality through superior photography.
Food subject: ${subjectAnchor}

[DISH GEOMETRY — LOCKED]
The food arrangement from the reference photo is preserved exactly. Do not deconstruct, separate, rearrange, or restage food components.
Do not impose fine-dining styling on food that isn't fine-dining. A burger stays a burger. A pizza stays a pizza.
What changes: lighting quality, color grade, background depth, surface material. The food itself does not change.

[COMPOSITION]
Framing: Three-quarter overhead or elegant slight angle. Full dish clearly visible. Plate not cropped by frame edges.
The plate edge and surrounding negative space contribute to editorial feel — but food on the plate is as in the reference.

[IN FRAME]
The dish exactly as photographed — primary components, garnish, and plating arrangement preserved.
Surface visible at the edges. No competing elements.

[FRAMING RULES]
Frame to reveal the dish at its most compelling angle. Surface and depth of field create the editorial quality.
Plate must not be cropped by the frame edges.

${qualityLayer}

[GUARDRAILS]
No added lifestyle props. No utensils unless already present in reference. No hands.
No warped food geometry. No text or overlays.
Do not add fine-dining plating elements (swooshes, microgreens, dots) that are not in the original.
The dish arrangement is the only version — photograph it beautifully, do not restyle it.

Directive: ${brief.image_final_prompt} Editorial plate — same dish, magazine-level photography. Food arrangement locked.`
  }

  if (photoTemplate === 'ingredient-focus') {
    return `${templateDirective}[SHOT GOAL]
A single ingredient or component isolated and elevated — hero-level close-up on one element.
Food subject: ${subjectAnchor} — isolate the most visually compelling component already present in the dish.

[DISH GEOMETRY — LOCKED]
Do not add, remove, or rearrange food components not in the reference. Isolate and zoom into what is already there.

[COMPOSITION]
Framing: Tight macro. The single hero ingredient fills a significant portion of the frame.
Focal point: Maximum texture, surface detail, and material quality rendered in the hero ingredient.
Other dish elements may appear as soft-background support — never competing.

[IN FRAME]
One dominant ingredient or food component — sharp, detailed, tactile.
Surrounding dish elements may be present in soft out-of-focus background only.
Background compressed to near-abstract bokeh.

[FRAMING RULES]
Single point of focus — the hero ingredient only. Everything else is context.
No wide dish view. No table scene visible.
Extreme optical depth — hero sharp, everything else falling away.

${qualityLayer}

[GUARDRAILS]
No lifestyle props. No table setting. No environment visible.
No added hands. No text or overlays. No warped food geometry.
One ingredient is the entire story — no competing visual elements.

Directive: ${brief.image_final_prompt} Ingredient focus — one component, maximum detail and intimacy.`
  }

  if (photoTemplate === 'someone-eating') {
    return `${templateDirective}[SHOT GOAL]
Implied human presence and enjoyment — the dish in a moment of consumption, suggesting a real human encounter without showing a person.
Food subject: ${subjectAnchor}

[COMPOSITION]
Framing: Three-quarter or close angle. Human scale implied by utensil position or portion state.
State: Dish mid-consumption — a portion removed, a bite taken, a utensil resting in the food — or posed to suggest imminent eating.
The "eaten" portion and "remaining" portion create visual tension and craving.

[IN FRAME]
The dish in its consumption state.
A utensil may rest in or beside the food: fork mid-bite, spoon resting, chopsticks positioned.
No hands. No people. No faces. Implied presence through food state only.

[FRAMING RULES]
The evidence of human presence is the story — not the human.
Dish fills a significant portion of the frame. The consumption state is clearly readable.

${qualityLayer}

[GUARDRAILS]
No hands in frame. No people. No faces. No limbs.
Implied presence only through dish state and utensil positioning.
No lifestyle props beyond utensils. No text or overlays. No warped food geometry.

Directive: ${brief.image_final_prompt} Implied dining moment — human presence through dish state, never through the human.`
  }

  if (mode === 'enhanced') {
    return `${templateDirective}[PRODUCTION TIER]
Camera: Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background: optical depth matching the original photo's character.
Quality: Master retoucher pass — the technical finish a professional retoucher applies to a RAW file before magazine publication.

[SCENE — FULLY LOCKED]
${brief.tier_1_locked}
Hero anchor: ${subjectAnchor}
Perspective: ${brief.camera_angle}. Preserve exactly. No reframing, no recomposition, no crop changes.
Surface, background, plating, garnish, item count, ingredient placement: identical to original.
Original light direction: preserved. Only intensity and balance are refined.

[RETOUCHER PASS]
${brief.tier_2_enhanced}
Re-light physically — preserve the original direction, fix balance, recover shadow detail without flattening contrast, control hot highlights.
Lighting refinement: ${lightingLine} — applied to the existing light direction, not replacing it.
Reconstruct specular highlights on glossy surfaces, sauces, glassware, oil sheen — physically accurate, never artificial.
Surface micro-texture rendered with material accuracy: wood grain, ceramic glaze, food char, herb edge, condensation as already visible.
Optical subject/background separation through real depth-of-field falloff, not artificial blur.
Texture: ${brief.creative_direction.texture_notes}
Optics: ${brief.creative_direction.lens_intent}
Color: correct white balance and color casts. Restore true-to-life food tones. ${colorLine}
Atmospheric depth between hero and background (subtle air, micro-haze in deep background only).

[GUARDRAILS]
This is a retouch, not a reinterpretation.
No added drama. No mood shift. No new surface. No new props. No new background.
No steam, condensation, ambient particles, or atmospheric elements that were not in the original.
No cinematic grading. No stylization. No reframing.
The result must be recognizably the same photo as the original — only finished to a level phone editing cannot reach.

Directive: ${brief.image_final_prompt} Finish at master-retoucher level — beyond what phone editing can do, faithful to the original.`
  }

  if (mode === 'editorial') {
    const tier3Line = moodAtmo
      ? `${brief.tier_3_reimagined} Target atmosphere: ${moodAtmo}.`
      : brief.tier_3_reimagined
    return `${templateDirective}[PRODUCTION TIER]
Camera: Simulated full-frame sensor, 100mm f/1.4 Macro. Subject tack-sharp. Background: artful creamy bokeh, magazine depth.
Quality: Magazine editorial reshoot — food stylist + creative director + magazine photographer collaboration.

[DISH IDENTITY — PRESERVED, RE-PLATED]
Food subject: ${subjectAnchor}. The dish must remain recognizable as the same product — same general dish type and identity.
A food stylist has re-plated the dish from scratch: garnish redone, sauce drizzles re-styled, herbs replaced and re-positioned, composition re-arranged on the plate with intentional placement and negative space.
Perspective family: ${brief.camera_angle} — may be slightly refined for magazine composition.

[SET — COMPLETELY REDESIGNED]
A new surface chosen to serve the aesthetic and complement this dish: marble, slate, weathered oak, brushed concrete, linen, stone — pick what makes this image iconic.
The background is rebuilt. The world around the dish is restaged from scratch.
Subtle styling elements allowed if they serve the composition: linen napkin, single utensil, oil drizzle on the surface, herb stem placement, scattered crumbs that read as deliberate. NO lifestyle narrative props.
${tier3Line}

[LIGHTING DESIGN]
${lightingLine} A deliberate creative lighting stance — distinct in character from the original. May be moody chiaroscuro, bright airy daylight, golden raking light, or cool minimalist depending on the aesthetic chosen.
Texture: ${brief.creative_direction.texture_notes}
Color: ${colorLine} A strong, cohesive color world that gives this image a single recognizable identity.

[COMPOSITION]
Magazine-quality framing. Rule of thirds, leading lines, intentional negative space.
The dish is the unmistakable hero. The set serves it.

[GUARDRAILS]
The dish identity must remain unmistakable as the original product — no transforming a burger into something else.
No lifestyle narrative props (no full glass of wine, no companion plate, no candles). That is Cinematic territory.
No surreal or CGI elements. No added people or hands.
The reshoot must look obviously different from the original — not a filter, not a refinement.

Directive: ${brief.image_final_prompt} Magazine-stylist reshoot — same dish, completely new image identity.`
  }

  if (mode === 'cinematic') {
    return `${templateDirective}[PRODUCTION TIER]
Camera: Simulated cinema sensor, 50mm f/1.2. Film-quality single-frame still. Full campaign production. Magazine-cover-grade rendering.
Quality: Bespoke brand campaign — the dish as hero of a TV-commercial-grade narrative scene.

[DISH IDENTITY — PRESERVED]
Food subject: ${subjectAnchor}. The dish must remain recognizable as the same product. It may be re-plated to suit the scene composition.

[SCENE — FULLY STAGED]
Build a complete bespoke environment around this dish. A chosen location with narrative purpose: restaurant interior, sunlit terrace, moody bar, marble kitchen counter at golden hour, candlelit dinner table, weathered street-food cart — whatever makes this dish iconic.
${moodAtmo ? `Target atmosphere: ${moodAtmo}.` : ''}

[LIFESTYLE STAGING]
Add complementary props that tell a story about when and why someone would crave this dish:
- A glass of wine, beer, or cocktail beside it
- A second complementary plate or food element in soft background focus
- Ambient cutlery, napkins, table dressing
- Candles, ambient florals, table accents
- Context-appropriate accents (lemon wedge near seafood, espresso cup beside dessert, herb sprigs and oils near pasta)
Every prop earns its place — narrative, not clutter.

[ATMOSPHERIC STORYTELLING]
Build texture into the air. Rising steam from a hot dish. Light condensation on a cold drink. Drifting smoke from a grill. Window light streaming. Candle flicker glow. Ambient particles caught in raking light. Soft haze in the deep background. These elements live in the world, not as overlays.

[LIGHTING & GRADE]
${lightingLine}
${colorLine}
Cinematic lighting designed from scratch for this scene. Let light shape the world — direction, color temperature, falloff, atmosphere all serve the campaign mood.

[COMPOSITION]
Narrative scene composition. The dish is the focal point, but the world around it has depth, props, and story. Multi-subject framing where the hero is unmistakable and the supporting elements add context.

[GUARDRAILS]
The dish must remain recognizable as the original product.
No added people or hands in frame.
No text, graphics, or overlays.
No warped food geometry. No surreal or CGI feel — this must read as a real, photographed campaign scene.

Directive: ${brief.image_final_prompt} Bespoke campaign — build a TV-commercial-grade world around this dish.`
  }

  // Default fallback
  const tier3Line = moodAtmo
    ? `${brief.tier_3_reimagined} Target atmosphere: ${moodAtmo}.`
    : brief.tier_3_reimagined
  return `${templateDirective}[PRODUCTION TIER]
Camera: Simulated full-frame sensor, 100mm f/1.8 Macro. Subject tack-sharp. Background: creamy bokeh.
Quality: Commercial Editorial — Direct-to-Advertising register. Maximum surface definition. Physics-based specular highlights on all appropriate surfaces.

[TIER 1 — LOCKED]
${brief.tier_1_locked}
Hero anchor: ${subjectAnchor}
Perspective: ${brief.camera_angle}. Do not flip or radically recompose.

[TIER 2 — ENHANCED]
${brief.tier_2_enhanced}
Lighting: ${lightingLine}
Texture: ${brief.creative_direction.texture_notes}
Optics: ${brief.creative_direction.lens_intent}

[TIER 3 — REIMAGINED]
${tier3Line}
Color: ${colorLine}

[GUARDRAILS]
Premium commercial food editorial. Billboard quality.
No new objects. No added hands. No added people. No change to item count. No altered plating.
No glowing halos. No neon effects. No artificial saturation. No CGI look. No warped food geometry.
Render all surfaces with organic, tactile grain. Soft shadow roll-off and physics-based specular highlights only.
Natural saturation. True-to-life tones.

Directive: ${brief.image_final_prompt}`
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

    const postTopic = campaign?.post_topic ?? ''

    const { data: brand } = campaign
      ? await supabase
          .from('brands')
          .select(
            'name, description, brand_voice, business_type, food_drink_type, atmosphere, personality',
          )
          .eq('id', campaign.brand_id)
          .single()
      : { data: null }

    const brandName = brand?.name ?? ''
    const brandVoice = brand?.brand_voice ?? ''
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
