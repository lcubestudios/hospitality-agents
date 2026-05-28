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

const VIDEOS = [
  {
    id: 'dining-moment',
    refImage: 'hero-close-up.jpg',
    prompt: `Warm candlelit restaurant scene. The camera starts close to the seared salmon on a white plate, dish centered vertically in the frame. The camera performs a slow, smooth pull-back over 6 seconds, gradually revealing the full dining table: wine glass in soft focus to the side, silverware, folded linen napkin, warm candlelight glowing in the restaurant interior. The dish remains centered vertically throughout the pull-back.
This is a physical camera dolly move backward — focal length stays constant, only the camera body moves back. No optical zoom-out. Slow, smooth, elegant motion.
Camera: steady backward dolly pull only. No lateral drift. No zoom. Dish centered vertically throughout.
9:16 vertical portrait. Zero text, watermarks, or overlays. Silent.`,
  },
]

async function submitJob(tpl) {
  const instance = { prompt: tpl.prompt }
  if (tpl.refImage) {
    const refBase64 = readFileSync(resolve(outDir, tpl.refImage)).toString('base64')
    instance.image = { bytesBase64Encoded: refBase64, mimeType: 'image/jpeg' }
  }
  const res = await fetch(
    `${BASE_URL}/models/veo-3.0-fast-generate-001:predictLongRunning?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [instance],
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
