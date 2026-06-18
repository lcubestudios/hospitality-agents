import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const env = readFileSync(resolve(root, '.env.local'), 'utf8')
const GOOGLE_API_KEY = env.match(/GOOGLE_AI_STUDIO_KEY=(.+)/)?.[1]?.trim()

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const outDir = resolve(root, 'public/templates')
mkdirSync(outDir, { recursive: true })

const refImageBase64 = readFileSync(resolve(outDir, 'hero-close-up.jpg')).toString('base64')
const refImageMime = 'image/jpeg'

const REMAINING = [
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
Background parallax creates dimensional depth.

[SPEED & TIMING]
Smooth, cinematic film pace. Dish occupies center frame at the midpoint of the clip.
Complete the full lateral pass by the 4-second mark. Format: 9:16 portrait.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
Purely lateral — no vertical component. No angle changes. Fixed focal length. No zoom.`,
  },
  {
    id: 'dining-moment',
    prompt: `[MOTION GOAL]
The dish alive in a dining context — the full table scene, ambient and social, as if witnessed in real life.

[CAMERA BEHAVIOR]
A gentle environmental pull-back that allows the dining setting context to breathe.
Camera moves as a participant, not a studio operator.

[SPEED & TIMING]
Gentle, unhurried. The pace of noticing something beautiful at dinner. Complete by 4 seconds. Format: 9:16 portrait.

[SCENE]
The seared salmon fillet on a white plate in a warm restaurant setting.
Wine glass in soft background focus, cutlery, folded linen napkin, ambient candlelight glow. Gentle steam from the hot fish.

[GUARDRAILS]
Zero Typography. No text, subtitles, watermarks, overlays. Silent. No audio.
No hands added. No people. No theatrical camera motion.`,
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
  if (!res.ok) throw new Error(`Submit failed (${res.status}): ${await res.text()}`)
  const { name } = await res.json()
  return name
}

async function pollUntilDone(operationName, id) {
  for (let i = 0; i < 72; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const res = await fetch(`${BASE_URL}/${operationName}?key=${GOOGLE_API_KEY}`)
    if (!res.ok) continue
    const data = await res.json()
    if (data.done) {
      const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null
      if (!uri) throw new Error(`No video URI for ${id}`)
      return uri
    }
    process.stdout.write(`\r  ${id}: polling... ${(i + 1) * 5}s`)
  }
  throw new Error(`Timed out for ${id}`)
}

// Run sequentially to avoid quota errors
for (const tpl of REMAINING) {
  process.stdout.write(`\nSubmitting ${tpl.id}... `)
  try {
    const operationName = await submitJob(tpl)
    console.log(`submitted`)
    const videoUri = await pollUntilDone(operationName, tpl.id)
    process.stdout.write(`\n  ${tpl.id}: done — downloading...`)
    const videoRes = await fetch(`${videoUri}&key=${GOOGLE_API_KEY}`)
    const buf = Buffer.from(await videoRes.arrayBuffer())
    writeFileSync(resolve(outDir, `${tpl.id}.mp4`), buf)
    console.log(` saved (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
    // Brief pause between jobs
    await new Promise((r) => setTimeout(r, 3000))
  } catch (err) {
    console.log(`\n  ${tpl.id}: FAILED — ${err.message}`)
  }
}

console.log('\nDone.')
