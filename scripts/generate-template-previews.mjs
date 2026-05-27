import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Read env
const env = readFileSync(resolve(root, '.env.local'), 'utf8')
const GOOGLE_API_KEY = env.match(/GOOGLE_AI_STUDIO_KEY=(.+)/)?.[1]?.trim()
if (!GOOGLE_API_KEY) {
  console.error('GOOGLE_AI_STUDIO_KEY not found in .env.local')
  process.exit(1)
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

// One consistent subject across all templates so the gallery feels cohesive
const SUBJECT = 'a perfectly seared salmon fillet with herb crust'

const TEMPLATES = [
  // Photo templates
  {
    id: 'hero-close-up',
    prompt: `Professional food photography. ${SUBJECT}. Tight hero close-up: the fish fills 80% of the frame. Three-quarter overhead angle. Background compressed to creamy bokeh. Single dominant focal point — the herb crust texture. No table scene, no lifestyle props. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'top-down-spread',
    prompt: `Professional food photography. ${SUBJECT} as hero plate, surrounded by supporting elements: a ramekin of lemon butter sauce, scattered fresh herbs, a side of roasted vegetables, and a small bowl of sea salt. Direct overhead flat lay. All items on a dark slate surface. Deliberate editorial arrangement with intentional negative space. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'in-setting',
    prompt: `Professional food photography. ${SUBJECT} placed on a restaurant table. Three-quarter angle. The dish is primary — the warm ambient restaurant environment is secondary, visible in background bokeh. Candlelight glow. Real dining context. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'editorial-plate',
    prompt: `Professional fine-dining food photography. ${SUBJECT} plated with precision on a wide white ceramic plate. Fine-dining presentation: intentional negative space on the plate, precisely placed herb garnish, sauce swipe executed with a spoon. Three-quarter overhead angle. The entire plate visible, nothing cropped. Magazine editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'ingredient-focus',
    prompt: `Professional macro food photography. Extreme tight close-up on the herb crust of ${SUBJECT}. A single ingredient isolated: the textured crust of chopped parsley, dill, and breadcrumbs on the fish surface. Fills the frame completely. Background falls to near-abstract bokeh. Maximum texture and detail. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'someone-eating',
    prompt: `Professional food photography. ${SUBJECT} mid-consumption: a portion has been eaten, a fork rests in the remaining fish. No hands in frame. No people. The eating moment is implied through dish state only — the fork position and the eaten portion create tension and craving. Three-quarter angle. Commercial editorial finish. 9:16 vertical format.`,
  },
  // Video templates (representative still frames)
  {
    id: 'slow-reveal',
    prompt: `Professional food photography. ${SUBJECT} shot from a dramatically low angle, the dish partially obscured by a shallow depth-of-field foreground element — the near edge of the plate, a blurred herb stem. The reveal is imminent but not yet complete. Cinematic, anticipatory composition. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'top-down-pan',
    prompt: `Professional food photography. ${SUBJECT} shot from directly overhead. Pure flat lay. Single dish centered on a dark slate surface with scattered fresh herbs around it. Clean, editorial overhead composition as if a camera were about to pan across it. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'ambient-motion',
    prompt: `Professional food photography. ${SUBJECT} still and centered. Delicate wisps of steam rising naturally from the hot fish surface. The air above the dish has visible atmospheric texture — soft light catching the steam. Near-static scene, all motion in the atmosphere. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'side-pass',
    prompt: `Professional food photography. ${SUBJECT} photographed from a side angle at dish level. Strong background parallax depth — the dish is sharp, the background falls away dramatically. Wide shot to suggest lateral camera movement. The dish holds the center of the frame. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'loop',
    prompt: `Professional food photography. ${SUBJECT} in a minimal, symmetric composition on a dark surface. Centered perfectly. The composition is equally readable from any direction — balanced, hypnotic, no dominant directional motion implied. Subtle steam. Commercial editorial finish. 9:16 vertical format.`,
  },
  {
    id: 'dining-moment',
    prompt: `Professional food photography. ${SUBJECT} in a real dining context. A full table setting: the dish as hero, a wine glass in soft background focus, cutlery, a folded linen napkin, ambient candlelight. Gentle pull-back angle showing the full dining moment. Warm, social, real-life feel. Commercial editorial finish. 9:16 vertical format.`,
  },
]

async function generateImage(prompt) {
  const res = await fetch(
    `${BASE_URL}/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
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
    const err = await res.text()
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const imagePart = data.candidates?.[0]?.content?.parts?.find((p) =>
    p.inlineData?.mimeType?.startsWith('image/'),
  )

  if (!imagePart?.inlineData?.data) {
    const candidate = data.candidates?.[0]
    throw new Error(`No image in response. Finish reason: ${candidate?.finishReason}`)
  }

  return Buffer.from(imagePart.inlineData.data, 'base64')
}

const outDir = resolve(root, 'public/templates')
mkdirSync(outDir, { recursive: true })

for (const tpl of TEMPLATES) {
  process.stdout.write(`Generating ${tpl.id}... `)
  try {
    const buf = await generateImage(tpl.prompt)
    const outPath = resolve(outDir, `${tpl.id}.jpg`)
    writeFileSync(outPath, buf)
    console.log(`done (${buf.length} bytes)`)
  } catch (err) {
    console.log(`FAILED: ${err.message}`)
  }
  // Brief pause between requests
  await new Promise((r) => setTimeout(r, 1000))
}

console.log(
  '\nAll done. Update examplePreview fields in CampaignCreator.tsx with /templates/<id>.jpg',
)
