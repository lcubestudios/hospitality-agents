'use client'

import { useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, Loader2, Download, AlertCircle, X, ZoomIn } from 'lucide-react'

interface GenerationResult {
  campaignId: string
  images: string[]
  caption: string
  hashtags: string[]
  totalPlanned: number
}

interface Brand {
  id: string
  name: string
  description: string
  brand_voice: string
  business_type: string
  food_drink_type: string
  location: string
  atmosphere: string[]
  personality: string[]
}

interface GenerateFormProps {
  brand: Brand
}

async function extractErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json()
    const detail = typeof body?.message === 'string' ? body.message : fallback
    console.error(`${fallback} (${res.status}):`, body)
    return `${detail} (${res.status})`
  } catch {
    console.error(`${fallback} (${res.status}): response body was not JSON`)
    return `${fallback} (${res.status})`
  }
}

export function GenerateForm({ brand }: GenerateFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [postTopic, setPostTopic] = useState('')
  const [brandVoice, setBrandVoice] = useState('Casual')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const BRAND_VOICE_OPTIONS = ['Professional', 'Casual', 'Friendly', 'Luxury', 'Trendy']
  const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB — Vercel's serverless function body limit is ~4.5MB and isn't configurable

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const isHeic =
      /\.(heic|heif)$/i.test(selectedFile.name) ||
      selectedFile.type === 'image/heic' ||
      selectedFile.type === 'image/heif'
    if (isHeic) {
      setError('HEIC/HEIF photos aren’t supported yet — please convert to JPG or PNG first')
      return
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only JPG, PNG, and WebP images are allowed')
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(
        `That photo is ${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB — please use one under 4MB`,
      )
      return
    }

    setFile(selectedFile)
    setError('')

    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('Please select an image')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Step 1: Create campaign
      const campaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brand.id,
          post_topic: postTopic || null,
        }),
      })

      if (!campaignRes.ok) {
        throw new Error(await extractErrorMessage(campaignRes, 'Failed to create campaign'))
      }

      const campaign = await campaignRes.json()

      // Step 2: Upload image
      const formData = new FormData()
      formData.append('file', file)
      formData.append('campaign_id', campaign.id)

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error(await extractErrorMessage(uploadRes, 'Failed to upload image'))
      }

      const { url: imageUrl } = await uploadRes.json()

      // Step 3: Generate
      const generateRes = await fetch(`/api/campaigns/${campaign.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          post_topic: postTopic || null,
          brand_voice_override: brandVoice,
        }),
      })

      if (!generateRes.ok) {
        throw new Error(await extractErrorMessage(generateRes, 'Generation failed'))
      }

      const generationResult = await generateRes.json()
      const images: string[] = generationResult.images || [generationResult.image_url || imageUrl]

      setResult({
        campaignId: campaign.id,
        images,
        caption: generationResult.caption || '',
        hashtags: generationResult.hashtags || [],
        totalPlanned: generationResult.total_planned || images.length,
      })

      // Reset form
      setFile(null)
      setPreview(null)
      setPostTopic('')
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Form */}
      <Card className="p-6">
        <form onSubmit={handleGenerate} className="space-y-4">
          {/* File Input */}
          <div>
            <Label htmlFor="photo">Product Photo</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:border-gray-400 hover:bg-gray-100"
            >
              <input
                ref={fileInputRef}
                type="file"
                id="photo"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-900">
                  {file ? file.name : 'Click to upload or drag and drop'}
                </p>
                {!file && <p className="text-xs text-gray-500">JPG, PNG, or WebP (max 4MB)</p>}
              </div>
            </div>
          </div>

          {/* Preview */}
          {preview && (
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <img src={preview} alt="Preview" className="h-40 w-full object-cover" />
            </div>
          )}

          {/* Post Topic */}
          <div>
            <Label htmlFor="post-topic">
              Post Topic <span className="text-gray-500">(optional)</span>
            </Label>
            <Input
              id="post-topic"
              placeholder="e.g., New menu item, seasonal special, limited offer"
              value={postTopic}
              onChange={(e) => setPostTopic(e.target.value)}
              disabled={loading}
              className="mt-1"
            />
          </div>

          {/* Brand Voice */}
          <div>
            <Label htmlFor="brand-voice">Brand Voice</Label>
            <select
              id="brand-voice"
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              disabled={loading}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {BRAND_VOICE_OPTIONS.map((voice) => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-red-700">
              <AlertCircle size={16} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" disabled={!file || loading} className="w-full">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Generating...' : 'Generate Campaign'}
          </Button>
        </form>
      </Card>

      {/* Results */}
      {result && (
        <Card className="p-6">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Campaign Album</h3>

          {result.images.length < result.totalPlanned && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-amber-800">
              <AlertCircle size={16} />
              <p className="text-sm">
                Generated {result.images.length} of {result.totalPlanned} planned images — the rest
                were blocked or failed. Try again, or adjust the photo/topic.
              </p>
            </div>
          )}

          {/* Image Grid with Download */}
          <div className="mb-6 grid grid-cols-2 gap-6">
            {result.images.map((imageUrl, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="group relative mb-2 overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src={imageUrl}
                    alt={`Campaign ${idx + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <button
                    onClick={() => setLightboxImage(imageUrl)}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40"
                  >
                    <ZoomIn
                      className="text-white opacity-0 transition-opacity group-hover:opacity-100"
                      size={28}
                    />
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    try {
                      const res = await fetch(imageUrl)
                      const blob = await res.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `campaign-${result.campaignId}-${idx + 1}.jpg`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    } catch (err) {
                      console.error('Download failed:', err)
                    }
                  }}
                >
                  <Download size={14} className="mr-2" />
                  Download
                </Button>
              </div>
            ))}
          </div>

          {/* Caption + Hashtags */}
          <div className="border-t pt-6">
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Instagram Caption</p>
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                  {result.caption}
                </p>
                {result.hashtags.length > 0 && (
                  <p className="text-sm text-gray-600">
                    {result.hashtags.map((tag) => `#${tag}`).join(' ')}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const fullCaption =
                    result.caption +
                    (result.hashtags.length > 0
                      ? '\n\n' + result.hashtags.map((tag) => `#${tag}`).join(' ')
                      : '')
                  navigator.clipboard.writeText(fullCaption)
                }}
              >
                Copy Caption
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img
              src={lightboxImage}
              alt="Expanded"
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 rounded-full bg-white/90 p-2 transition-colors hover:bg-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
