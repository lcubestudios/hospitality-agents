import { NextRequest, NextResponse } from 'next/server'
import { uploadImageToStorage } from '@/lib/upload'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const campaignId = formData.get('campaign_id') as string

    if (!file || !campaignId) {
      return NextResponse.json({ message: 'file and campaign_id are required' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: 'Only JPG, PNG, and WebP images are allowed' },
        { status: 400 },
      )
    }

    const publicUrl = await uploadImageToStorage(file, campaignId)
    return NextResponse.json({ url: publicUrl })
  } catch (err) {
    console.error('Upload error:', err)
    return NextResponse.json({ message: 'Upload failed' }, { status: 500 })
  }
}
