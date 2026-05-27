import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const env = readFileSync(resolve(root, '.env.local'), 'utf8')
const GOOGLE_API_KEY = env.match(/GOOGLE_AI_STUDIO_KEY=(.+)/)?.[1]?.trim()
if (!GOOGLE_API_KEY) {
  console.error('GOOGLE_AI_STUDIO_KEY not found in .env.local')
  process.exit(1)
}

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const outDir = resolve(root, 'public/templates')
mkdirSync(outDir, { recursive: true })

// Use the hero-close-up still as the reference image for all video generations —
// same subject, image-to-video so the pipeline mirrors how the real app works.
const refImagePath = resolve(outDir, 'hero-close-up.jpg')
const refImageBase64 = readFileSync(refImagePath).toString('base64')
const refImageMime = 'image/jpeg'

// Prompts mirror the buildVeoPrompt template branches (default quality layer, no Creative Mode)
const VIDEO_TEMPLATES = [
  {
    id: 'slow-reveal',
    prompt: `[MOTION GOAL]
The dish is not visible at the start. The camera gradually reveals it, building anticipation. The reveal is the emotional peak.

[CAMERA BEHAVIOR]
Begin with the dish obscured: low angle tight on a textural detail of the herb crust, close crop of the surface.
Move slowly and deliberately to reveal the full hero salmon fillet.
The reveal moment — when the dish is first fully visible — is the emotional climax of the clip.

[SPEED & TIMING]
Extremely slow, deliberate. The reveal feels like unwrapping something precious.
Complete the full reveal by the 4-second mark. Final frame: clean, beautiful composition of the seared salmon fillet with herb crust.
Format: 9:16 portrait.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
Single continuous reveal motion. No flash cuts.
Dish geometry locked once revealed. Fixed focal length. No zoom. No pan or tilt.`,
  },
  {
    id: 'top-down-pan',
    prompt: `[MOTION GOAL]
An overhead editorial descent or lateral sweep across the seared salmon fillet with herb crust. The camera travels through the composition from above.

[CAMERA BEHAVIOR]
Strictly overhead perspective. Camera moves in a smooth lateral sweep across the flat-lay composition of the salmon fillet on a dark slate surface with scattered fresh herbs.
The motion allows the dish and surrounding elements to pass through frame in a deliberate editorial sequence.

[SPEED & TIMING]
Controlled, unhurried. Magazine editorial pace. Complete the full motion story by the 4-second mark.
Format: 9:16 portrait.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
Strictly overhead — no angle changes, no tilts. Pure overhead translation.
No zoom. Fixed focal length.`,
  },
  {
    id: 'ambient-motion',
    prompt: `[MOTION GOAL]
Near-static camera. The motion comes from within the scene — the camera is a witness, not a performer.

[CAMERA BEHAVIOR]
Camera is essentially still — imperceptible micro-movement or completely static.
All visual interest from in-scene atmospheric motion: delicate wisps of steam rising naturally from the hot seared salmon surface, subtle light shimmer in the air above the fish.

[SPEED & TIMING]
Extremely slow, patient. The scene breathes. Steam rises continuously throughout.
Format: 9:16 portrait.

[SCENE]
The seared salmon fillet with herb crust, static and centered. Steam rises from the hot fish surface.
One atmospheric element: rising steam. Restrained.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
Camera movement imperceptible or completely absent. No theatrical camera motion.`,
  },
  {
    id: 'side-pass',
    prompt: `[MOTION GOAL]
The camera travels laterally past the seared salmon fillet. The dish stays fixed; the camera moves through a world.

[CAMERA BEHAVIOR]
Pure lateral tracking shot. Camera moves from one side to the other at a consistent, smooth speed.
The salmon fillet is introduced from one edge of the frame, moves through center-frame, and the motion continues to the opposite edge.
Background parallax creates dimensional depth — foreground dish moves faster than background dark slate surface.

[SPEED & TIMING]
Smooth, cinematic film pace. Dish occupies center frame at the midpoint of the clip.
Complete the full lateral pass by the 4-second mark. Format: 9:16 portrait.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
Purely lateral — no vertical component. No angle changes. Fixed focal length. No zoom.
Dish geometry remains static. Only the camera translates.`,
  },
  {
    id: 'loop',
    prompt: `[MOTION GOAL]
A perfectly seamless, hypnotic loop. The clip plays forward and could play backward — the cut is invisible.

[CAMERA BEHAVIOR]
A slow vertical descent that could reverse as a rise — camera moves slowly downward toward the salmon fillet from a slightly elevated position, then could seamlessly reverse.
The motion is extremely subtle, barely perceptible in real time.

[SPEED & TIMING]
Extremely slow. Hypnotic, not dramatic. The loop cut must be invisible.
Format: 9:16 portrait.

[SCENE]
The seared salmon fillet with herb crust, minimal and symmetric on a dark surface.
Subtle steam that rises and dissipates in the same cadence, looping naturally.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
Motion works in reverse. No reveals. No directional entering shots. Fixed focal length.`,
  },
  {
    id: 'dining-moment',
    prompt: `[MOTION GOAL]
The dish alive in a dining context — the full table scene, ambient and social, as if witnessed in real life.

[CAMERA BEHAVIOR]
A gentle environmental pull-back that allows the dining setting context to breathe.
The table setting and ambient context are visible. Camera moves as a participant, not a studio operator.

[SPEED & TIMING]
Gentle, unhurried. The pace of noticing something beautiful at dinner. Complete by 4 seconds. Format: 9:16 portrait.

[SCENE]
The seared salmon fillet on a white plate in a warm restaurant setting.
Wine glass in soft background focus, cutlery, folded linen napkin, ambient candlelight glow. Gentle steam from the hot fish.
Environmental light: warm restaurant ambient, candle flicker.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
No hands added. No people. No theatrical camera motion.
Dining context from the environment and arrangement — not from added staging.`,
  },
]

async function submitJob(template) {
  const res = await fetch(
    `${BASE_URL}/models/veo-3.0-fast-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: template.prompt,
            image: { bytesBase64Encoded: refImageBase64, mimeType: refImageMime },
          },
        ],
        parameters: { aspectRatio: '9:16', durationSeconds: 8 },
      }),
    },
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Submit failed (${res.status}): ${err}`)
  }
  const { name } = await res.json()
  return name
}

async function pollUntilDone(operationName, id) {
  const maxAttempts = 60 // 5 minutes max per job
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const res = await fetch(`${BASE_URL}/${operationName}?key=${GOOGLE_API_KEY}`)
    if (!res.ok) continue
    const data = await res.json()
    if (data.done) {
      const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null
      if (!uri) throw new Error(`Job done but no video URI for ${id}`)
      return uri
    }
    const elapsed = (i + 1) * 5
    process.stdout.write(`\r  ${id}: polling... ${elapsed}s elapsed`)
  }
  throw new Error(`Timed out after 5 minutes for ${id}`)
}

async function downloadVideo(uri) {
  const res = await fetch(`${uri}&key=${GOOGLE_API_KEY}`)
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return Buffer.from(await res.arrayBuffer())
}

console.log('Submitting all 6 video jobs in parallel...\n')

// Submit all jobs simultaneously
const jobs = await Promise.all(
  VIDEO_TEMPLATES.map(async (tpl) => {
    try {
      const operationName = await submitJob(tpl)
      console.log(`  ${tpl.id}: submitted (${operationName.slice(-20)})`)
      return { tpl, operationName, error: null }
    } catch (err) {
      console.log(`  ${tpl.id}: SUBMIT FAILED — ${err.message}`)
      return { tpl, operationName: null, error: err.message }
    }
  }),
)

console.log('\nPolling jobs until complete...\n')

// Poll and download each job
await Promise.all(
  jobs.map(async ({ tpl, operationName, error }) => {
    if (error || !operationName) return

    try {
      const videoUri = await pollUntilDone(operationName, tpl.id)
      process.stdout.write(`\n  ${tpl.id}: done — downloading...`)
      const buf = await downloadVideo(videoUri)
      const outPath = resolve(outDir, `${tpl.id}.mp4`)
      writeFileSync(outPath, buf)
      console.log(` saved (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
    } catch (err) {
      console.log(`\n  ${tpl.id}: FAILED — ${err.message}`)
    }
  }),
)

console.log(
  '\nAll done. Update examplePreview fields in CampaignCreator.tsx with /templates/<id>.mp4 and exampleType: "video"',
)
