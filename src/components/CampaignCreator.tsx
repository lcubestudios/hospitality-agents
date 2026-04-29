'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const MAX_PHOTOS = 3

type Stage = 'idle' | 'uploading' | 'generating' | 'captioning' | 'done' | 'error'

interface PhotoSlot {
  file: File
  preview: string
  uploadedUrl: string | null
}

interface CaptionResult {
  caption: string
  hashtags: string[]
}

const STEPS: { key: Stage; label: string }[] = [
  { key: 'uploading', label: 'Uploading photos' },
  { key: 'generating', label: 'Generating image' },
  { key: 'captioning', label: 'Writing caption' },
]

export function CampaignCreator({ brandId }: { brandId: string }) {
  const [stage, setStage] = useState<Stage>('idle')
  const [postTopic, setPostTopic] = useState('')
  const [photos, setPhotos] = useState<PhotoSlot[]>([])
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [captionResult, setCaptionResult] = useState<CaptionResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [regenImageLoading, setRegenImageLoading] = useState(false)
  const [regenCaptionLoading, setRegenCaptionLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? [])
    if (!picked.length) return

    setPhotos((prev) => {
      const remaining = MAX_PHOTOS - prev.length
      const toAdd = picked.slice(0, remaining).map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        uploadedUrl: null,
      }))
      return [...prev, ...toAdd]
    })

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleReplacePhoto(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (!picked) return
    setPhotos((prev) =>
      prev.map((slot, i) =>
        i === index
          ? { file: picked, preview: URL.createObjectURL(picked), uploadedUrl: null }
          : slot,
      ),
    )
  }

  function handleRemovePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleGenerate() {
    if (!photos.length) return
    setError('')
    setCaptionResult(null)
    setResultUrl(null)

    try {
      setStage('uploading')

      const campaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, post_topic: postTopic }),
      })
      if (!campaignRes.ok) throw new Error('Failed to create campaign')
      const campaign = await campaignRes.json()
      setCampaignId(campaign.id)

      const urls: string[] = []
      for (const slot of photos) {
        const formData = new FormData()
        formData.append('file', slot.file)
        formData.append('campaign_id', campaign.id)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!uploadRes.ok) throw new Error('Failed to upload photo')
        const { url } = await uploadRes.json()
        urls.push(url)
      }

      setUploadedUrls(urls)
      setPhotos((prev) => prev.map((slot, i) => ({ ...slot, uploadedUrl: urls[i] ?? null })))

      setStage('generating')
      const generateRes = await fetch(`/api/campaigns/${campaign.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: urls[0] }),
      })
      if (!generateRes.ok) throw new Error('Image generation failed')
      const { asset_url } = await generateRes.json()
      setResultUrl(asset_url)

      setStage('captioning')
      const captionRes = await fetch(`/api/campaigns/${campaign.id}/caption`, { method: 'POST' })
      if (!captionRes.ok) throw new Error('Caption generation failed')
      setCaptionResult(await captionRes.json())

      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  async function handleRegenImage() {
    if (!campaignId) {
      setError('No campaign found — generate first.')
      return
    }
    if (!uploadedUrls.length) {
      setError('No uploaded photos found — generate first.')
      return
    }
    setRegenImageLoading(true)
    setError('')

    try {
      const generateRes = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: uploadedUrls[0] }),
      })
      if (!generateRes.ok) throw new Error('Image regeneration failed')
      const { asset_url } = await generateRes.json()
      setResultUrl(`${asset_url}?t=${Date.now()}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRegenImageLoading(false)
    }
  }

  async function handleRegenCaption() {
    if (!campaignId) return
    setRegenCaptionLoading(true)
    setError('')

    try {
      const captionRes = await fetch(`/api/campaigns/${campaignId}/caption`, { method: 'POST' })
      if (!captionRes.ok) throw new Error('Caption regeneration failed')
      setCaptionResult(await captionRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRegenCaptionLoading(false)
    }
  }

  async function handleCopy() {
    if (!captionResult) return
    const hashtags = captionResult.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')
    await navigator.clipboard.writeText(`${captionResult.caption}\n\n${hashtags}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLoading = stage === 'uploading' || stage === 'generating' || stage === 'captioning'
  const hasGenerated = stage === 'done' || stage === 'error'

  return (
    <div className="space-y-6">
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
            <div className="mb-2 flex items-center justify-between">
              <Label>
                Product photos ({photos.length}/{MAX_PHOTOS})
              </Label>
              {photos.length < MAX_PHOTOS && (
                <label className="cursor-pointer rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200">
                  + Add photo
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handleAddPhotos}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {photos.length === 0 && (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-400 hover:border-gray-400">
                Click to upload up to {MAX_PHOTOS} photos
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleAddPhotos}
                  className="hidden"
                />
              </label>
            )}

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {photos.map((slot, i) => (
                  <div key={i} className="group relative">
                    <img
                      src={slot.preview}
                      alt={`Photo ${i + 1}`}
                      className="h-28 w-full rounded-lg border object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <label className="cursor-pointer rounded bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">
                        Replace
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleReplacePhoto(i, e)}
                          className="hidden"
                        />
                      </label>
                      <button
                        onClick={() => handleRemovePhoto(i)}
                        className="rounded bg-white px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isLoading && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-4">
              {STEPS.map(({ key, label }) => {
                const stepIndex = STEPS.findIndex((s) => s.key === stage)
                const thisIndex = STEPS.findIndex((s) => s.key === key)
                const isDone = thisIndex < stepIndex
                const isActive = key === stage

                return (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span
                      className={
                        isDone ? 'text-green-500' : isActive ? 'text-blue-500' : 'text-gray-300'
                      }
                    >
                      {isDone ? '✓' : isActive ? '●' : '○'}
                    </span>
                    <span
                      className={
                        isDone
                          ? 'text-gray-400 line-through'
                          : isActive
                            ? 'font-medium text-gray-800'
                            : 'text-gray-300'
                      }
                    >
                      {label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={!photos.length || isLoading}
            className="w-full"
          >
            {isLoading
              ? 'Working...'
              : hasGenerated
                ? 'Generate Again'
                : 'Generate Image + Caption'}
          </Button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {resultUrl && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Enhanced Image</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenImage}
              disabled={regenImageLoading}
            >
              {regenImageLoading ? 'Regenerating...' : 'Regenerate'}
            </Button>
          </div>
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
              Download
            </Button>
          </a>
        </Card>
      )}

      {captionResult && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Instagram Caption</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenCaption}
                disabled={regenCaptionLoading}
              >
                {regenCaptionLoading ? 'Regenerating...' : 'Regenerate'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy All'}
              </Button>
            </div>
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
