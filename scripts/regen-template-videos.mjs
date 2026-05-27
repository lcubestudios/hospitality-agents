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

// Corrected prompts — explicit, unambiguous camera direction
const VIDEOS = [
  {
    id: 'top-down-pan',
    prompt: `Strictly overhead flat-lay shot. The camera is positioned directly above the dish pointing straight down — a pure bird's-eye view. You see the top surface of the seared salmon fillet on a dark slate surface from above, as if shot from directly overhead like a drone or overhead camera rig. The camera does not tilt or angle at any point.
The camera performs a slow, smooth lateral pan: moving from left to right across the dish while staying at the same overhead height. The overhead perspective is maintained throughout the entire clip.
Camera movement: lateral pan only — strictly sideways, no angle change, no vertical movement, no zoom.
9:16 vertical portrait. Zero text, watermarks, or overlays. Silent.`,
  },
  {
    id: 'ambient-motion',
    prompt: `Completely static camera — the camera does not move at all. No zoom, no pan, no tilt, no drift, no pull back. Fixed in place for the full duration.
The frame shows the complete seared salmon fillet with herb crust on a dark slate surface at a normal shooting distance — the full dish is visible, not zoomed into a detail.
The only motion in the entire clip comes from within the scene: wisps of delicate steam rising naturally and gently from the hot surface of the salmon fillet, drifting slowly upward. Nothing else moves.
9:16 vertical portrait. Zero text, watermarks, or overlays. Silent.`,
  },
  {
    id: 'loop',
    prompt: `Seamlessly looping clip. The camera makes a very slow, minimal lateral drift — moving gently 1 to 2 inches from left to right over 4 seconds. The motion is so subtle it is barely perceptible. No zoom. No vertical movement. No push or pull toward the dish. No camera rotation.
The composition is essentially identical at the beginning and end of the clip, so it loops invisibly. The seared salmon fillet fills the center of the frame throughout.
Camera movement: tiny lateral drift only. No zoom whatsoever.
9:16 vertical portrait. Zero text, watermarks, or overlays. Silent.`,
  },
  {
    id: 'dining-moment',
    prompt: `Gentle, smooth pull-back shot in a warm restaurant setting. The camera begins closer to the seared salmon fillet on a white plate and smoothly pulls straight back over 4 seconds to reveal the full dining scene: the plate with the herb-crusted salmon, a wine glass to the side in soft focus, silverware, a folded linen napkin, and warm candlelight glowing in a restaurant interior.
The pull-back is slow, continuous, and smooth — observational, like noticing the dish arrive at a candlelit dinner table. The final frame shows the complete, beautiful dining scene.
Camera movement: steady backward pull only. No lateral drift. No pan.
9:16 vertical portrait. Zero text, watermarks, or overlays. Silent.`,
  },
]

async function submitJob(tpl) {
  const res = await fetch(
    `${BASE_URL}/models/veo-3.0-fast-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [
          {
            prompt: tpl.prompt,
            image: { bytesBase64Encoded: refImageBase64, mimeType: refImageMime },
          },
        ],
        parameters: { aspectRatio: '9:16', durationSeconds: 8 },
      }),
    },
  )
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`)
  return (await res.json()).name
}

async function pollUntilDone(operationName, id) {
  for (let i = 0; i < 72; i++) {
    await new Promise((r) => setTimeout(r, 5000))
    const res = await fetch(`${BASE_URL}/${operationName}?key=${GOOGLE_API_KEY}`)
    if (!res.ok) continue
    const data = await res.json()
    if (data.done) {
      const uri = data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ?? null
      if (!uri) throw new Error(`No video URI`)
      return uri
    }
    process.stdout.write(`\r  ${id}: ${(i + 1) * 5}s...`)
  }
  throw new Error(`Timed out`)
}

for (const tpl of VIDEOS) {
  process.stdout.write(`\n[${tpl.id}] Submitting... `)
  try {
    const op = await submitJob(tpl)
    console.log('submitted')
    const uri = await pollUntilDone(op, tpl.id)
    process.stdout.write(`\n  Downloading... `)
    const res = await fetch(`${uri}&key=${GOOGLE_API_KEY}`)
    const buf = Buffer.from(await res.arrayBuffer())
    writeFileSync(resolve(outDir, `${tpl.id}.mp4`), buf)
    console.log(`saved (${(buf.length / 1024 / 1024).toFixed(1)} MB)`)
    if (tpl !== VIDEOS[VIDEOS.length - 1]) {
      process.stdout.write('  Waiting 65s for rate limit... ')
      await new Promise((r) => setTimeout(r, 65000))
      console.log('done')
    }
  } catch (err) {
    console.log(`\n  FAILED: ${err.message}`)
  }
}
console.log('\nDone.')
