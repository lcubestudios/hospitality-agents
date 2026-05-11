'use client'

import { useRef, useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, Circle, Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DirectorBrief } from '@/app/api/campaigns/[id]/generate/route'
import type { ArchiveEntry } from '@/components/ArchivesTab'

const MAX_PHOTOS = 1

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

type ExpandedOutput = 'generating' | 'captioning' | 'videoing'

interface Tooltip {
  label: string
  tip: string
}

function TooltipIcon({ tip }: { tip: string }) {
  return (
    <div className="group relative inline-flex items-center">
      <Info size={13} className="cursor-help text-gray-400 hover:text-gray-600" />
      <div className="pointer-events-none absolute right-0 bottom-full z-50 mb-2 w-56 rounded bg-gray-800 px-2.5 py-1.5 text-xs leading-relaxed text-white opacity-0 transition-opacity group-hover:opacity-100">
        {tip}
      </div>
    </div>
  )
}

const ACTION_TOOLTIPS: Tooltip[] = [
  {
    label: 'Save to Archive',
    tip: 'Save this campaign to your Archive for later reference. You will be prompted for a name.',
  },
  {
    label: 'Download All',
    tip: 'Download image, video, and caption as separate files in one click.',
  },
  {
    label: 'Regenerate All',
    tip: 'Keep the same photo and topic but regenerate all selected outputs.',
  },
  {
    label: 'New Campaign',
    tip: 'Start fresh with a new photo and topic. Current outputs will be cleared.',
  },
]

export function CampaignCreator({
  brandId,
  archives = [],
  onArchiveSaved,
  onDeleteArchive,
}: {
  brandId: string
  archives?: ArchiveEntry[]
  onArchiveSaved?: () => void
  onDeleteArchive?: (id: string) => Promise<void>
}) {
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
  const [directorBrief, setDirectorBrief] = useState<DirectorBrief | null>(null)
  const [expandedOutputs, setExpandedOutputs] = useState<Set<ExpandedOutput>>(new Set())

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [archiveName, setArchiveName] = useState('')
  const [archiveDescription, setArchiveDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null)
  const [expandedModalArchiveId, setExpandedModalArchiveId] = useState<string | null>(null)

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

  const progressSteps: { key: Stage; activeLabel: string; doneLabel: string }[] = [
    ...(!isRegen
      ? [
          {
            key: 'uploading' as Stage,
            activeLabel: 'Uploading photos',
            doneLabel: 'Photos uploaded',
          },
        ]
      : []),
    ...(generationOptions.image
      ? [
          {
            key: 'generating' as Stage,
            activeLabel: 'Generating image',
            doneLabel: 'View Generated Image',
          },
        ]
      : []),
    ...(generationOptions.caption
      ? [
          {
            key: 'captioning' as Stage,
            activeLabel: 'Writing caption',
            doneLabel: 'View Generated Caption',
          },
        ]
      : []),
    ...(generationOptions.video
      ? [
          {
            key: 'videoing' as Stage,
            activeLabel: 'Generating video',
            doneLabel: 'View Generated Video',
          },
        ]
      : []),
  ]

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

  async function runGenerationSteps(cId: string, urls: string[]) {
    let freshImageUrl: string | null = null
    let freshBrief: DirectorBrief | null = null

    if (generationOptions.image) {
      setStage('generating')
      const res = await fetch(`/api/campaigns/${cId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: urls[0] }),
      })
      if (!res.ok) throw new Error('Image generation failed')
      const data = await res.json()
      freshImageUrl = data.asset_url
      freshBrief = data.director_brief ?? null
      setResultUrl(data.asset_url)
      setDirectorBrief(freshBrief)
    }

    if (generationOptions.caption) {
      setStage('captioning')
      const res = await fetch(`/api/campaigns/${cId}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: urls[0] ?? null }),
      })
      if (!res.ok) throw new Error('Caption generation failed')
      setCaptionResult(await res.json())
    }

    if (generationOptions.video) {
      setStage('videoing')
      const res = await fetch(`/api/campaigns/${cId}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: freshImageUrl ?? resultUrl ?? urls[0],
          director_brief: freshBrief ?? directorBrief ?? null,
        }),
      })
      if (!res.ok) throw new Error('Video generation failed')
      const { asset_url } = await res.json()
      setVideoUrl(asset_url)
    }
  }

  async function handleGenerate() {
    if (!generationOptions.image && !generationOptions.caption && !generationOptions.video) {
      setError('Select at least one output to generate.')
      return
    }
    if ((generationOptions.image || generationOptions.video) && !photos.length) {
      setError('Image and video generation require photos.')
      return
    }
    setError('')
    setResultUrl(null)
    setCaptionResult(null)
    setVideoUrl(null)

    try {
      const campaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, post_topic: postTopic }),
      })
      if (!campaignRes.ok) throw new Error('Failed to create campaign')
      const campaign = await campaignRes.json()
      setCampaignId(campaign.id)

      const urls: string[] = []
      if (photos.length > 0) {
        setStage('uploading')
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
      }

      await runGenerationSteps(campaign.id, urls)
      setStage('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStage('error')
    }
  }

  async function handleRegenerateAll() {
    if (!campaignId || !uploadedUrls.length) return
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

  function handleNewCampaign() {
    setStage('idle')
    setCampaignId(null)
    setUploadedUrls([])
    setPhotos([])
    setPostTopic('')
    setResultUrl(null)
    setCaptionResult(null)
    setVideoUrl(null)
    setDirectorBrief(null)
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
    if (!campaignId) return
    setRegenCaptionLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: uploadedUrls[0] ?? null }),
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

  // NOTE: caption download as .txt may be deprecated in a future iteration
  function handleDownloadAll() {
    if (resultUrl) {
      const a = document.createElement('a')
      a.href = resultUrl
      a.download = 'enhanced-product.jpg'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    if (videoUrl) {
      const a = document.createElement('a')
      a.href = videoUrl
      a.download = 'campaign-video.mp4'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
    if (captionResult) {
      const text = `${captionResult.caption}\n\n${captionResult.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}`
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'caption.txt'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  async function handleSaveToArchive() {
    if (!archiveName.trim()) {
      setSaveError('Name is required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const res = await fetch('/api/archives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: archiveName.trim(),
          description: archiveDescription.trim() || null,
          image_url: resultUrl ?? null,
          video_url: videoUrl ?? null,
          caption: captionResult?.caption ?? null,
          hashtags: captionResult?.hashtags ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save')
      }
      setSaveModalOpen(false)
      setArchiveName('')
      setArchiveDescription('')
      onArchiveSaved?.()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteFromModal(id: string) {
    setDeletingArchiveId(id)
    try {
      await onDeleteArchive?.(id)
      setSaveError('')
    } finally {
      setDeletingArchiveId(null)
    }
  }

  function loadTestData() {
    setCampaignId('test-campaign-id')
    setPostTopic('Test: Truffle pizza')
    setStage('done')
    setGenerationOptions({ image: true, caption: true, video: true })
    setResultUrl(
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23ddd" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" font-size="20" fill="%23666" text-anchor="middle" dy=".3em"%3EMock Image%3C/text%3E%3C/svg%3E',
    )
    setCaptionResult({
      caption:
        'Fresh truffle pizza, loaded with real shaved truffles and creamy fontina. This is the one you have been dreaming about.',
      hashtags: ['trufflepizza', 'pizza', 'foodie', 'italianfood'],
    })
    setVideoUrl(
      'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc2FjAAACAIABAIADAAADAAAAAGZyZWUAAAG/bWRhdAAAB/AAACBQu',
    )
  }

  const inputsLocked = !isIdle
  const photosRequired = generationOptions.image || generationOptions.video
  const canGenerate = postTopic.trim() && (photosRequired ? photos.length > 0 : true)

  return (
    <div className="space-y-6">
      {/* Input card */}
      <Card className="p-6" ref={cardRef}>
        <div className="space-y-4">
          {/* Topic */}
          <div>
            <Label htmlFor="post_topic">What is this post about?</Label>
            <textarea
              id="post_topic"
              placeholder="e.g. Launching our new truffle pizza this Friday — include the food or drink name for best results"
              value={postTopic}
              onChange={(e) => setPostTopic(e.target.value)}
              readOnly={inputsLocked}
              rows={2}
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm read-only:cursor-default read-only:bg-gray-50 read-only:text-gray-500 focus:ring-2 focus:outline-none"
            />
          </div>

          {/* Photos */}
          {(photosRequired || photos.length > 0) && (
            <div className={inputsLocked ? 'opacity-60' : ''}>
              <div className="mb-2 flex items-center justify-between">
                <Label>
                  Product photos and/or videos ({photos.length}/{MAX_PHOTOS})
                </Label>
                {!inputsLocked && photos.length < MAX_PHOTOS && (
                  <label className="cursor-pointer rounded-md bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200">
                    + Add file
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                      multiple
                      onChange={handleAddPhotos}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {!inputsLocked && photos.length === 0 && photosRequired && (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-8 text-center text-sm text-gray-400 hover:border-gray-400">
                  Click to upload up to {MAX_PHOTOS} photos/videos
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
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
          )}

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

          {/* Progress/Output Accordion */}
          {(isLoading || hasOutputs) && progressSteps.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {progressSteps.map(({ key, activeLabel, doneLabel }, i) => {
                const stepIndex = progressSteps.findIndex((s) => s.key === stage)
                const thisIndex = i
                const isDone = stage === 'done' || thisIndex < stepIndex
                const isActive = key === stage && isLoading
                const isExpanded = expandedOutputs.has(key as ExpandedOutput)

                let outputContent: React.ReactNode = null
                let hasOutput = false

                if (key === 'generating' && resultUrl) {
                  hasOutput = true
                  outputContent = (
                    <div className="flex flex-col gap-3">
                      <div className="min-h-40 overflow-hidden rounded border bg-white">
                        <img
                          src={resultUrl}
                          alt="Enhanced"
                          className="h-full w-full object-cover"
                        />
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
                  )
                } else if (key === 'captioning' && captionResult) {
                  hasOutput = true
                  outputContent = (
                    <div className="flex flex-col gap-3">
                      <div className="rounded border bg-white p-4">
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
                  )
                } else if (key === 'videoing' && videoUrl) {
                  hasOutput = true
                  outputContent = (
                    <div className="flex flex-col gap-3">
                      <div className="min-h-40 overflow-hidden rounded border bg-white">
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
                  )
                }

                const displayLabel = isDone && hasOutput ? doneLabel : activeLabel

                return (
                  <div key={key}>
                    <button
                      onClick={() => {
                        if (hasOutput) {
                          setExpandedOutputs((prev) => {
                            const next = new Set(prev)
                            if (next.has(key as ExpandedOutput)) {
                              next.delete(key as ExpandedOutput)
                            } else {
                              next.add(key as ExpandedOutput)
                            }
                            return next
                          })
                        }
                      }}
                      className={[
                        'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors duration-300',
                        i > 0 ? 'border-t border-gray-200' : '',
                        isActive ? 'animate-pulse bg-blue-50' : '',
                        hasOutput && !isActive ? 'cursor-pointer hover:bg-gray-100' : '',
                      ].join(' ')}
                    >
                      <span className="flex-shrink-0">
                        {isDone && <CheckCircle size={15} className="text-green-500" />}
                        {isActive && <Loader2 size={15} className="animate-spin text-blue-500" />}
                        {!isDone && !isActive && <Circle size={15} className="text-gray-300" />}
                      </span>
                      <span
                        className={
                          isDone && hasOutput
                            ? 'font-semibold text-gray-800'
                            : isDone
                              ? 'text-gray-500'
                              : isActive
                                ? 'font-medium text-gray-800'
                                : 'text-gray-400'
                        }
                      >
                        {displayLabel}
                      </span>
                      {hasOutput && (
                        <span className="ml-auto flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp size={15} className="text-gray-400" />
                          ) : (
                            <ChevronDown size={15} className="text-gray-400" />
                          )}
                        </span>
                      )}
                    </button>
                    {hasOutput && isExpanded && (
                      <div className="border-t border-gray-200 bg-white px-4 py-3">
                        {outputContent}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {isIdle && (
            <div className="flex flex-col gap-2">
              <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full">
                Generate Campaign
              </Button>
              {process.env.NODE_ENV === 'development' && (
                <Button
                  onClick={loadTestData}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  Test Data (UI only, no API)
                </Button>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Card>

      {/* Action buttons */}
      {hasOutputs && (
        <Card className="overflow-visible p-6">
          <p className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
            Next Actions
          </p>
          <div className="space-y-2">
            {ACTION_TOOLTIPS.map(({ label, tip }) => {
              let onClick: () => void
              let disabled = false
              let primary = false

              if (label === 'Save to Archive') {
                onClick = () => {
                  setSaveError('')
                  setSaveModalOpen(true)
                }
                primary = true
              } else if (label === 'Download All') {
                onClick = handleDownloadAll
              } else if (label === 'Regenerate All') {
                onClick = handleRegenerateAll
                disabled = isLoading
              } else {
                onClick = handleNewCampaign
                disabled = isLoading
              }

              return (
                <div key={label} className="flex items-center gap-2">
                  <Button
                    onClick={onClick}
                    disabled={disabled}
                    variant={primary ? 'default' : 'outline'}
                    className="flex-1"
                  >
                    {label}
                  </Button>
                  <TooltipIcon tip={tip} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Save to Archive modal */}
      <Dialog
        open={saveModalOpen}
        onOpenChange={(open) => {
          if (!saving) setSaveModalOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save to Archive</DialogTitle>
            <DialogDescription>
              Give this campaign a name so you can find it later in your Archives.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="archive_name">Name *</Label>
              <Input
                id="archive_name"
                value={archiveName}
                onChange={(e) => setArchiveName(e.target.value)}
                placeholder="e.g. Truffle pizza launch"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="archive_description">Description</Label>
              <Input
                id="archive_description"
                value={archiveDescription}
                onChange={(e) => setArchiveDescription(e.target.value)}
                placeholder="e.g. April campaign, warm tones"
                className="mt-1"
              />
            </div>
            {saveError && (
              <div className="space-y-2">
                <p className="text-sm text-red-600">{saveError}</p>
                {archives.length >= 5 && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
                    <p className="mb-2 text-xs font-medium text-gray-700">
                      Delete one to free up a slot:
                    </p>
                    <ul className="space-y-1">
                      {archives.map((a) => {
                        const isExpanded = expandedModalArchiveId === a.id
                        const created = new Date(a.created_at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                        return (
                          <li key={a.id} className="rounded border border-gray-200 bg-white">
                            <div className="flex items-center gap-2 px-2 py-1.5">
                              <button
                                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                onClick={() => setExpandedModalArchiveId(isExpanded ? null : a.id)}
                              >
                                <ChevronDown
                                  size={12}
                                  className={`shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                                <span className="truncate text-xs font-medium text-gray-700">
                                  {a.name}
                                </span>
                                <span className="shrink-0 text-xs text-gray-400">{created}</span>
                              </button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 shrink-0 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                disabled={deletingArchiveId === a.id}
                                onClick={() => handleDeleteFromModal(a.id)}
                              >
                                {deletingArchiveId === a.id ? 'Deleting...' : 'Delete'}
                              </Button>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-gray-100 px-2 py-1.5 text-xs text-gray-500">
                                {a.description ?? <span className="italic">No description</span>}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveToArchive} disabled={saving || !archiveName.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
