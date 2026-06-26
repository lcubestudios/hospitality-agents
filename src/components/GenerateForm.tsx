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

export function GenerateForm({ brand }: GenerateFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [postTopic, setPostTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Only JPG, PNG, and WebP images are allowed')
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
        throw new Error('Failed to create campaign')
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
        throw new Error('Failed to upload image')
      }

      const { url: imageUrl } = await uploadRes.json()

      // Step 3: Generate
      const generateRes = await fetch(`/api/campaigns/${campaign.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          post_topic: postTopic || null,
        }),
      })

      if (!generateRes.ok) {
        throw new Error('Generation failed')
      }

      const generationResult = await generateRes.json()

      setResult({
        campaignId: campaign.id,
        images: generationResult.images || [generationResult.image_url || imageUrl],
        caption: generationResult.caption || '',
        hashtags: generationResult.hashtags || [],
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
                {!file && <p className="text-xs text-gray-500">JPG, PNG, or WebP (max 10MB)</p>}
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
          <h3 className="mb-6 text-lg font-semibold text-gray-900">Campaign Album</h3>

          {/* Image Grid */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            {result.images.map((imageUrl, idx) => (
              <div
                key={idx}
                className="group relative overflow-hidden rounded-lg border border-gray-200"
              >
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
            ))}
          </div>

          {/* Download All */}
          <div className="mb-6 flex flex-wrap gap-2">
            {result.images.map((imageUrl, idx) => (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = imageUrl
                  a.download = `campaign-${result.campaignId}-${idx + 1}.jpg`
                  a.click()
                }}
              >
                <Download size={14} className="mr-2" />
                Download {idx + 1}
              </Button>
            ))}
          </div>

          {/* Caption + Hashtags */}
          <div className="space-y-3 border-t pt-6">
            <div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                {result.caption}
              </p>
              {result.hashtags.length > 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  {result.hashtags.map((tag) => `#${tag}`).join(' ')}
                </p>
              )}
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
