'use client'

import { useRef, useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Circle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const MAX_PHOTOS = 3
const MAX_ARCHIVES = 2

type Stage = 'idle' | 'generating' | 'captioning' | 'uploading' | 'videoing' | 'done' | 'error'

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

interface OutputArchive {
  id: number
  imageUrl?: string
  captionResult?: CaptionResult
  videoUrl?: string
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
  const [archives, setArchives] = useState<OutputArchive[]>([])
  const [expandedArchiveId, setExpandedArchiveId] = useState<number | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isLoading =
    stage === 'uploading' ||
    stage === 'generating' ||
    stage === 'captioning' ||
    stage === 'videoing'
  const isIdle = stage === 'idle'
  const hasOutputs = !!(resultUrl || captionResult || videoUrl)
  const isRegen = !!campaignId

  // Progress steps — uploading only shown on first generate
  const progressSteps: { key: Stage; label: string }[] = [
    ...(!isRegen ? [{ key: 'uploading' as Stage, label: 'Uploading photos' }] : []),
    ...(generationOptions.image ? [{ key: 'generating' as Stage, label: 'Generating image' }] : []),
    ...(generationOptions.caption
      ? [{ key: 'captioning' as Stage, label: 'Writing caption' }]
      : []),
    ...(generationOptions.video ? [{ key: 'videoing' as Stage, label: 'Generating video' }] : []),
  ]

  function saveCurrentToArchive() {
    if (!resultUrl && !captionResult && !videoUrl) return
    const entry: OutputArchive = {
      id: Date.now(),
      imageUrl: resultUrl ?? undefined,
      captionResult: captionResult ?? undefined,
      videoUrl: videoUrl ?? undefined,
    }
    setArchives((prev) => [entry, ...prev].slice(0, MAX_ARCHIVES))
  }

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

  // Core generation steps — shared by initial generate and regen
  async function runGenerationSteps(cId: string, urls: string[]) {
    let freshImageUrl: string | null = null
    let freshCaption: string | null = null

    if (generationOptions.image) {
      setStage('generating')
      const res = await fetch(`/api/campaigns/${cId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: urls[0] }),
      })
      if (!res.ok) throw new Error('Image generation failed')
      const { asset_url } = await res.json()
      freshImageUrl = asset_url
      setResultUrl(asset_url)
    }

    if (generationOptions.caption) {
      setStage('captioning')
      const res = await fetch(`/api/campaigns/${cId}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: urls[0] }),
      })
      if (!res.ok) throw new Error('Caption generation failed')
      const data = await res.json()
      freshCaption = data.caption
      setCaptionResult(data)
    }

    if (generationOptions.video) {
      setStage('videoing')
      const res = await fetch(`/api/campaigns/${cId}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: freshCaption ?? captionResult?.caption ?? '',
          // pass enhanced image if generated this run, else fall back to original upload
          image_url: freshImageUrl ?? resultUrl ?? urls[0],
        }),
      })
      if (!res.ok) throw new Error('Video generation failed')
      const { asset_url } = await res.json()
      setVideoUrl(asset_url)
    }
  }

  async function handleGenerate() {
    if (!photos.length) return
    if (!generationOptions.image && !generationOptions.caption && !generationOptions.video) {
      setError('Select at least one output to generate.')
      return
    }
    setError('')
    setResultUrl(null)
    setCaptionResult(null)
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

      await runGenerationSteps(campaign.id, urls)
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  async function handleRegenerateAll() {
    if (!campaignId || !uploadedUrls.length) return
    saveCurrentToArchive()
    setResultUrl(null)
    setCaptionResult(null)
    setVideoUrl(null)
    setError('')
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

    try {
      await runGenerationSteps(campaignId, uploadedUrls)
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  function handleGenerateWithDifferentInput() {
    saveCurrentToArchive()
    setStage('idle')
    setCampaignId(null)
    setUploadedUrls([])
    setPhotos([])
    setPostTopic('')
    setResultUrl(null)
    setCaptionResult(null)
    setVideoUrl(null)
    setError('')
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleRegenImage() {
    if (!campaignId || !uploadedUrls.length) return
    setRegenImageLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: uploadedUrls[0] }),
      })
      if (!res.ok) throw new Error('Image regeneration failed')
      const { asset_url } = await res.json()
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
      const res = await fetch(`/api/campaigns/${campaignId}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: uploadedUrls[0] }),
      })
      if (!res.ok) throw new Error('Caption regeneration failed')
      setCaptionResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setRegenCaptionLoading(false)
    }
  }

  async function handleRegenVideo() {
    if (!campaignId) return
    setVideoLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: captionResult?.caption ?? '',
          image_url: resultUrl ?? uploadedUrls[0],
        }),
      })
      if (!res.ok) throw new Error('Video regeneration failed')
      const { asset_url } = await res.json()
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

  function deleteArchive(id: number) {
    setArchives((prev) => prev.filter((a) => a.id !== id))
    if (expandedArchiveId === id) setExpandedArchiveId(null)
  }

  const inputsLocked = !isIdle

  return (
    <div className="space-y-6">
      {/* Input card */}
      <Card className="p-6" ref={cardRef}>
        <h2 className="mb-4 text-xl font-bold">Campaign Creator</h2>

        <div className="space-y-4">
          {/* Topic */}
          <div>
            <Label htmlFor="post_topic">What is this post about?</Label>
            <textarea
              id="post_topic"
              placeholder="e.g. Launching our new truffle pizza this Friday night"
              value={postTopic}
              onChange={(e) => setPostTopic(e.target.value)}
              readOnly={inputsLocked}
              rows={2}
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm read-only:cursor-default read-only:bg-gray-50 read-only:text-gray-500 focus:ring-2 focus:outline-none"
            />
          </div>

          {/* Photos */}
          <div className={inputsLocked ? 'opacity-60' : ''}>
            <div className="mb-2 flex items-center justify-between">
              <Label>
                Product photos ({photos.length}/{MAX_PHOTOS})
              </Label>
              {!inputsLocked && photos.length < MAX_PHOTOS && (
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

            {!inputsLocked && photos.length === 0 && (
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
                    {!inputsLocked && (
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
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Output selection */}
          <div className={inputsLocked ? 'opacity-60' : ''}>
            <Label className="mb-2 block">What would you like to generate?</Label>
            <div className="space-y-2">
              {(
                [
                  { key: 'image', label: 'Enhanced Product Image' },
                  { key: 'caption', label: 'Caption + Hashtags' },
                  { key: 'video', label: 'Short Video (~8s, takes 2-3 min)' },
                ] as const
              ).map(({ key, label }) => (
                <label key={key} className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={generationOptions[key]}
                    onChange={(e) =>
                      setGenerationOptions((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    disabled={inputsLocked}
                    className="rounded border border-gray-300 disabled:cursor-default"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Progress indicator */}
          {isLoading && progressSteps.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {progressSteps.map(({ key, label }, i) => {
                const stepIndex = progressSteps.findIndex((s) => s.key === stage)
                const thisIndex = progressSteps.findIndex((s) => s.key === key)
                const isDone = thisIndex < stepIndex
                const isActive = key === stage
                return (
                  <div
                    key={key}
                    className={[
                      'flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-300',
                      i > 0 ? 'border-t border-gray-200' : '',
                      isActive ? 'animate-pulse bg-blue-50' : '',
                    ].join(' ')}
                  >
                    <span className="flex-shrink-0">
                      {isDone && <CheckCircle size={15} className="text-green-500" />}
                      {isActive && <Loader2 size={15} className="animate-spin text-blue-500" />}
                      {!isDone && !isActive && <Circle size={15} className="text-gray-300" />}
                    </span>
                    <span
                      className={
                        isDone
                          ? 'text-gray-400 line-through'
                          : isActive
                            ? 'font-medium text-gray-800'
                            : 'text-gray-400'
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
            <Button onClick={handleGenerate} disabled={!photos.length} className="w-full">
              Generate Campaign
            </Button>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {/* Outputs card */}
      {hasOutputs && (
        <Card className="p-6">
          <h3 className="mb-6 text-lg font-semibold">Campaign Outputs</h3>

          {/* Output grid */}
          <div
            className={
              [resultUrl, captionResult, videoUrl].filter(Boolean).length === 1
                ? 'grid grid-cols-1'
                : [resultUrl, captionResult, videoUrl].filter(Boolean).length === 2
                  ? 'grid grid-cols-2 gap-6'
                  : 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'
            }
          >
            {resultUrl && (
              <div className="flex flex-col gap-3">
                <div className="min-h-64 overflow-hidden rounded-lg border bg-gray-50">
                  <img src={resultUrl} alt="Enhanced" className="h-full w-full object-cover" />
                </div>
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
            )}

            {videoUrl && (
              <div className="flex flex-col gap-3">
                <div className="min-h-64 overflow-hidden rounded-lg border bg-gray-50">
                  <video src={videoUrl} controls className="h-full w-full" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenVideo}
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
            )}
          </div>

          {/* Bottom actions */}
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

          {/* Archives */}
          {archives.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <p className="mb-3 text-xs font-medium tracking-wide text-gray-400 uppercase">
                Previous Outputs
              </p>
              <div className="space-y-2">
                {archives.map((archive) => (
                  <div key={archive.id} className="rounded-lg border border-gray-200 bg-gray-50">
                    {/* Archive header row */}
                    <div className="flex items-center gap-3 p-3">
                      {archive.imageUrl && (
                        <img
                          src={archive.imageUrl}
                          alt="Archive"
                          className="h-10 w-10 flex-shrink-0 rounded object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1 text-xs text-gray-500">
                        {archive.captionResult ? (
                          <p className="truncate">{archive.captionResult.caption}</p>
                        ) : (
                          <p className="text-gray-400">
                            {[archive.imageUrl && 'Image', archive.videoUrl && 'Video']
                              .filter(Boolean)
                              .join(' + ')}
                          </p>
                        )}
                        {archive.videoUrl && (
                          <span className="text-blue-400">
                            {archive.captionResult ? ' · video' : ''}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setExpandedArchiveId(expandedArchiveId === archive.id ? null : archive.id)
                        }
                        className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                      >
                        {expandedArchiveId === archive.id ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => deleteArchive(archive.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Archive expanded view */}
                    {expandedArchiveId === archive.id && (
                      <div className="flex flex-wrap gap-3 border-t border-gray-200 p-3">
                        {archive.imageUrl && (
                          <img
                            src={archive.imageUrl}
                            alt="Archived image"
                            className="h-40 rounded border object-cover"
                          />
                        )}
                        {archive.captionResult && (
                          <div className="min-w-48 flex-1 text-xs text-gray-700">
                            <p className="mb-2 leading-relaxed">{archive.captionResult.caption}</p>
                            <div className="flex flex-wrap gap-1">
                              {archive.captionResult.hashtags.map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full bg-blue-50 px-1.5 py-0.5 text-blue-500"
                                >
                                  #{tag.replace(/^#/, '')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {archive.videoUrl && (
                          <video src={archive.videoUrl} controls className="h-40 rounded border" />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
