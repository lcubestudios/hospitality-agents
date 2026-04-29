'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

type Stage = 'idle' | 'uploading' | 'generating' | 'captioning' | 'done' | 'error'

interface CaptionResult {
  caption: string
  hashtags: string[]
}

export function CampaignCreator({ brandId }: { brandId: string }) {
  const [stage, setStage] = useState<Stage>('idle')
  const [postTopic, setPostTopic] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [captionResult, setCaptionResult] = useState<CaptionResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
    setResultUrl(null)
    setCaptionResult(null)
    setError('')
    setStage('idle')
  }

  async function handleGenerate() {
    if (!file) return
    setError('')
    setCaptionResult(null)

    try {
      // 1. Create campaign record
      setStage('uploading')
      const campaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, post_topic: postTopic }),
      })
      if (!campaignRes.ok) throw new Error('Failed to create campaign')
      const campaign = await campaignRes.json()

      // 2. Upload original photo
      const formData = new FormData()
      formData.append('file', file)
      formData.append('campaign_id', campaign.id)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) throw new Error('Failed to upload photo')
      const { url: imageUrl } = await uploadRes.json()

      // 3. Generate enhanced image
      setStage('generating')
      const generateRes = await fetch(`/api/campaigns/${campaign.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageUrl }),
      })
      if (!generateRes.ok) throw new Error('Generation failed')
      const { asset_url } = await generateRes.json()
      setResultUrl(asset_url)

      // 4. Generate caption
      setStage('captioning')
      const captionRes = await fetch(`/api/campaigns/${campaign.id}/caption`, {
        method: 'POST',
      })
      if (!captionRes.ok) throw new Error('Caption generation failed')
      const captionData = await captionRes.json()
      setCaptionResult(captionData)

      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  async function handleCopy() {
    if (!captionResult) return
    const hashtags = captionResult.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')
    await navigator.clipboard.writeText(`${captionResult.caption}\n\n${hashtags}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusLabel: Record<Stage, string> = {
    idle: 'Generate Image + Caption',
    uploading: 'Uploading photo...',
    generating: 'Generating image... (~30s)',
    captioning: 'Writing caption...',
    done: 'Generate Another',
    error: 'Try Again',
  }

  const isLoading = stage === 'uploading' || stage === 'generating' || stage === 'captioning'

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-bold">Campaign Creator</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="post_topic">What is this post about?</Label>
            <textarea
              id="post_topic"
              placeholder="e.g. Launching our new truffle pizza this Friday night"
              value={postTopic}
              onChange={(e) => setPostTopic(e.target.value)}
              rows={2}
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>

          <div>
            <Label htmlFor="photo">Upload product photo</Label>
            <input
              id="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          {preview && (
            <div>
              <p className="mb-1 text-sm text-gray-500">Original</p>
              <img
                src={preview}
                alt="Original"
                className="max-h-64 rounded-lg border object-contain"
              />
            </div>
          )}

          <Button onClick={handleGenerate} disabled={!file || isLoading} className="w-full">
            {statusLabel[stage]}
          </Button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {resultUrl && (
        <Card className="p-6">
          <h3 className="mb-3 text-lg font-semibold">Enhanced Image</h3>
          <img
            src={resultUrl}
            alt="Enhanced"
            className="mb-4 w-full rounded-lg border object-contain"
          />
          <a
            href={resultUrl}
            download="enhanced-product.jpg"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="w-full">
              Download Enhanced Image
            </Button>
          </a>
        </Card>
      )}

      {captionResult && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Instagram Caption</h3>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy All'}
            </Button>
          </div>
          <p className="mb-4 text-sm leading-relaxed whitespace-pre-wrap text-gray-800">
            {captionResult.caption}
          </p>
          <div className="flex flex-wrap gap-1">
            {captionResult.hashtags.map((tag) => (
              <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600">
                #{tag.replace(/^#/, '')}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
