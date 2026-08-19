import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToStorage } from '@/lib/upload'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // Vercel's serverless function body limit is ~4.5MB and isn't configurable

// Magic-byte signatures — client-supplied File.type is untrusted and unreliable (e.g. empty for HEIC in some browsers)
function sniffImageType(
  bytes: Uint8Array,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'heic' | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a
  )
    return 'image/png'
  if (
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50 // "WEBP" at offset 8 in the RIFF header
  )
    return 'image/webp'
  // ISO base media file (ftyp box) with an HEIC/HEIF brand at offset 8
  const ftypBrand = String.fromCharCode(...bytes.slice(8, 12))
  if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(ftypBrand)) return 'heic'
  return null
}

export async function POST(req: NextRequest) {
  let fileMeta: { name?: string; type?: string; size?: number } = {}
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const campaignId = formData.get('campaign_id') as string
    fileMeta = { name: file?.name, type: file?.type, size: file?.size }

    if (!file) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      console.warn('Upload rejected: file too large', fileMeta)
      return NextResponse.json(
        { message: `File is ${(file.size / (1024 * 1024)).toFixed(1)}MB — max is 4MB` },
        { status: 400 },
      )
    }

    const headBytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
    const sniffed = sniffImageType(headBytes)

    if (sniffed === 'heic') {
      console.warn('Upload rejected: HEIC/HEIF content', fileMeta)
      return NextResponse.json(
        { message: 'HEIC/HEIF photos aren’t supported — please convert to JPG or PNG first' },
        { status: 400 },
      )
    }

    if (!sniffed) {
      console.warn('Upload rejected: unrecognized file content', fileMeta)
      return NextResponse.json(
        { message: 'Only JPG, PNG, and WebP images are allowed' },
        { status: 400 },
      )
    }

    // campaign_id is optional (for intake photos) but required for storage routing
    // If not provided, use a temporary 'intake' prefix
    const storageCampaignId = campaignId || `intake/${Date.now()}`

    const publicUrl = await uploadImageToStorage(file, storageCampaignId)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('Upload error:', fileMeta, err)
    return NextResponse.json({ message: 'Upload failed' }, { status: 500 })
  }
}
