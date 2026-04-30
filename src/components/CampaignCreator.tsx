'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const MAX_PHOTOS = 3

type Stage = 'idle' | 'uploading' | 'generating' | 'captioning' | 'videoing' | 'done' | 'error'
type OutputType = 'image' | 'caption' | 'video'

interface PhotoSlot {
  file: File
  preview: string
  uploadedUrl: string | null
}

interface CaptionResult {
  caption: string
  hashtags: string[]
}

interface GenerationOptions {
  image: boolean
  caption: boolean
  video: boolean
}

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>({
    image: false,
    caption: false,
    video: false,
  })
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
    if (!generationOptions.image && !generationOptions.caption && !generationOptions.video) {
      setError('Please select at least one output to generate')
      return
    }
    setError('')
    setCaptionResult(null)
    setResultUrl(null)
    setVideoUrl(null)

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

      if (generationOptions.image) {
        setStage('generating')
        const generateRes = await fetch(`/api/campaigns/${campaign.id}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: urls[0] }),
        })
        if (!generateRes.ok) throw new Error('Image generation failed')
        const { asset_url } = await generateRes.json()
        setResultUrl(asset_url)
      }

      if (generationOptions.caption) {
        setStage('captioning')
        const captionRes = await fetch(`/api/campaigns/${campaign.id}/caption`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_url: urls[0] }),
        })
        if (!captionRes.ok) throw new Error('Caption generation failed')
        setCaptionResult(await captionRes.json())
      }

      if (generationOptions.video && (generationOptions.caption || captionResult)) {
        setStage('videoing')
        const caption = captionResult?.caption || ''
        const videoRes = await fetch(`/api/campaigns/${campaign.id}/video`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ caption }),
        })
        if (!videoRes.ok) throw new Error('Video generation failed')
        const { asset_url } = await videoRes.json()
        setVideoUrl(asset_url)
      }

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
    if (!campaignId || !uploadedUrls.length) return
    setRegenCaptionLoading(true)
    setError('')

    try {
      const captionRes = await fetch(`/api/campaigns/${campaignId}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: uploadedUrls[0] }),
      })
      if (!captionRes.ok) throw new Error('Caption regeneration failed')
      setCaptionResult(await captionRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRegenCaptionLoading(false)
    }
  }

  async function handleGenerateVideo() {
    if (!campaignId || !captionResult) return
    setVideoLoading(true)
    setError('')

    try {
      const videoRes = await fetch(`/api/campaigns/${campaignId}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: captionResult.caption }),
      })
      if (!videoRes.ok) throw new Error('Video generation failed')
      const { asset_url } = await videoRes.json()
      setVideoUrl(asset_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setVideoLoading(false)
    }
  }

  async function handleCopy() {
    if (!captionResult) return
    const hashtags = captionResult.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')
    await navigator.clipboard.writeText(`${captionResult.caption}\n\n${hashtags}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLoading =
    stage === 'uploading' ||
    stage === 'generating' ||
    stage === 'captioning' ||
    stage === 'videoing'
  const hasGenerated = stage === 'done' || stage === 'error'
  const isIdle = stage === 'idle'

  const selectedOutputs: OutputType[] = []
  if (generationOptions.image) selectedOutputs.push('image')
  if (generationOptions.caption) selectedOutputs.push('caption')
  if (generationOptions.video) selectedOutputs.push('video')

  const getStepsForSelectedOutputs = () => {
    const steps: { key: Stage; label: string }[] = [{ key: 'uploading', label: 'Uploading photos' }]
    if (generationOptions.image) steps.push({ key: 'generating', label: 'Generating image' })
    if (generationOptions.caption) steps.push({ key: 'captioning', label: 'Writing caption' })
    if (generationOptions.video) steps.push({ key: 'videoing', label: 'Generating video' })
    return steps
  }

  const currentSteps = getStepsForSelectedOutputs()

  async function handleRegenerateAll() {
    await handleGenerate()
  }

  function handleGenerateWithDifferentInput() {
    setStage('idle')
    setCampaignId(null)
    setUploadedUrls([])
    setPhotos([])
    setPostTopic('')
    setResultUrl(null)
    setCaptionResult(null)
    setVideoUrl(null)
    setError('')
  }

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
              readOnly={hasGenerated}
              rows={2}
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm read-only:bg-gray-50 read-only:text-gray-600 focus:ring-2 focus:outline-none"
            />
          </div>

          {isIdle && (
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
          )}

          {isIdle && (
            <div>
              <Label className="mb-2 block">What would you like to generate?</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generationOptions.image}
                    onChange={(e) =>
                      setGenerationOptions((prev) => ({ ...prev, image: e.target.checked }))
                    }
                    className="rounded border border-gray-300"
                  />
                  <span className="text-sm">Enhanced Product Image</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generationOptions.caption}
                    onChange={(e) =>
                      setGenerationOptions((prev) => ({ ...prev, caption: e.target.checked }))
                    }
                    className="rounded border border-gray-300"
                  />
                  <span className="text-sm">Caption + Hashtags</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generationOptions.video}
                    onChange={(e) =>
                      setGenerationOptions((prev) => ({ ...prev, video: e.target.checked }))
                    }
                    className="rounded border border-gray-300"
                  />
                  <span className="text-sm">Short Video (~8s, takes 2-3 min)</span>
                </label>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-4">
              {currentSteps.map(({ key, label }) => {
                const stepIndex = currentSteps.findIndex((s) => s.key === stage)
                const thisIndex = currentSteps.findIndex((s) => s.key === key)
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

          {isIdle && (
            <Button
              onClick={handleGenerate}
              disabled={!photos.length || isLoading}
              className="w-full"
            >
              {isLoading ? 'Working...' : 'Generate Campaign'}
            </Button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {(resultUrl || captionResult || videoUrl) && (
        <Card className="p-6">
          <h3 className="mb-6 text-lg font-semibold">Campaign Outputs</h3>

          {/* Grid layout */}
          <div
            className={`gap-6 ${
              selectedOutputs.length === 1
                ? 'grid grid-cols-1'
                : selectedOutputs.length === 2
                  ? 'grid grid-cols-2'
                  : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {resultUrl && (
              <div className="flex flex-col gap-3">
                <div className="min-h-64 overflow-hidden rounded-lg border bg-gray-50">
                  <img src={resultUrl} alt="Enhanced" className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenImage}
                    disabled={regenImageLoading}
                    className="w-full"
                  >
                    {regenImageLoading ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                  <a
                    href={resultUrl}
                    download="enhanced-product.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      Download
                    </Button>
                  </a>
                </div>
              </div>
            )}

            {captionResult && (
              <div className="flex flex-col gap-3">
                <div className="min-h-64 rounded-lg border bg-gray-50 p-4">
                  <p className="mb-4 text-sm leading-relaxed text-gray-800">
                    {captionResult.caption}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {captionResult.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                      >
                        #{tag.replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenCaption}
                    disabled={regenCaptionLoading}
                    className="w-full"
                  >
                    {regenCaptionLoading ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="w-full">
                    {copied ? 'Copied!' : 'Copy All'}
                  </Button>
                </div>
              </div>
            )}

            {videoUrl && (
              <div className="flex flex-col gap-3">
                <div className="min-h-64 overflow-hidden rounded-lg border bg-gray-50">
                  <video src={videoUrl} controls className="h-full w-full object-cover" />
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateVideo}
                    disabled={videoLoading}
                    className="w-full"
                  >
                    {videoLoading ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                  <a
                    href={videoUrl}
                    download="campaign-video.mp4"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      Download
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Bottom action buttons */}
          <div className="mt-8 space-y-2 border-t pt-4">
            <Button onClick={handleRegenerateAll} disabled={isLoading} className="w-full">
              Regenerate All
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateWithDifferentInput}
              disabled={isLoading}
              className="w-full"
            >
              Generate with Different Input
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
