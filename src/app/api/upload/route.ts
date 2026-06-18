import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToStorage } from '@/lib/upload'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const campaignId = formData.get('campaign_id') as string

    if (!file) {
      return NextResponse.json({ message: 'file is required' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
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
    console.error('Upload error:', err)
    return NextResponse.json({ message: 'Upload failed' }, { status: 500 })
  }
}
