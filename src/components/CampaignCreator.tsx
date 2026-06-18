'use client'

import { useRef, useState, useEffect } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Image, Info } from 'lucide-react'
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
import type { DirectorBrief, CreativeMode } from '@/app/api/campaigns/[id]/generate/route'
import type { ArchiveEntry } from '@/components/ArchivesTab'
import { SocialMockups } from '@/components/SocialMockups'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'idle' | 'generating' | 'captioning' | 'uploading' | 'videoing' | 'done' | 'error'
type TemplateType = 'photo' | 'video' | 'caption'
type GalleryTab = 'photo' | 'video'

interface PhotoSlot {
  file: File
  preview: string
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

type OutputTabType = 'outputs' | 'previews'

interface RequiredInput {
  id: string
  label: string
  description: string
  required: boolean
}

interface TemplateConfig {
  id: string
  label: string
  description: string
  type: TemplateType
  examplePreview: string
  exampleType: 'image' | 'video' | 'caption'
  promptIntent?: string
  minPhotos: number
  maxPhotos: number
  requiredInputs: RequiredInput[]
}

// ─── Template registry ─────────────────────────────────────────────────────────

const PHOTO_TEMPLATES: TemplateConfig[] = [
  {
    id: 'hero-close-up',
    label: 'Hero Close-Up',
    description: 'Single dish focus, tight composition',
    type: 'photo',
    examplePreview: '/templates/hero-close-up.jpg',
    exampleType: 'image',
    promptIntent:
      'Focus on the main subject with tight framing and strong texture detail. Hero fills the frame.',
    minPhotos: 1,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'The dish you want to enhance',
        required: true,
      },
    ],
  },
  {
    id: 'top-down-spread',
    label: 'Top-Down Spread',
    description: 'Overhead multi-plate or course layout',
    type: 'photo',
    examplePreview: '/templates/top-down-spread.jpg',
    exampleType: 'image',
    promptIntent:
      'Overhead flat lay composition. Multiple dishes or a full spread arranged on a surface. Even lighting.',
    minPhotos: 2,
    maxPhotos: 5,
    requiredInputs: [
      {
        id: 'plate1',
        label: 'Main plate',
        description: 'Primary dish or hero plate',
        required: true,
      },
      {
        id: 'plate2',
        label: 'Second plate',
        description: 'Additional plate or course',
        required: true,
      },
      { id: 'plate3', label: 'Third plate', description: 'Additional plate', required: false },
      { id: 'plate4', label: 'Fourth plate', description: 'Additional plate', required: false },
      { id: 'plate5', label: 'Fifth plate', description: 'Additional plate', required: false },
    ],
  },
  {
    id: 'in-setting',
    label: 'In Setting',
    description: 'Dish placed in restaurant or table environment',
    type: 'photo',
    examplePreview: '/templates/in-setting.jpg',
    exampleType: 'image',
    promptIntent:
      'Dish placed within a real dining environment. Table, ambient context, scene around the food.',
    minPhotos: 1,
    maxPhotos: 2,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'The dish to place in a setting',
        required: true,
      },
      {
        id: 'setting',
        label: 'Setting reference',
        description: 'Your restaurant or dining space',
        required: false,
      },
    ],
  },
  {
    id: 'editorial-plate',
    label: 'Editorial Plate',
    description: 'Refined magazine-style presentation',
    type: 'photo',
    examplePreview: '/templates/editorial-plate.jpg',
    exampleType: 'image',
    promptIntent:
      'Same dish, magazine-quality photography. Superior lighting, color, and composition — food arrangement preserved exactly as photographed.',
    minPhotos: 1,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'The dish to photograph in editorial style',
        required: true,
      },
    ],
  },
  {
    id: 'someone-eating',
    label: 'Someone Eating',
    description: 'Food with human interaction',
    type: 'photo',
    examplePreview: '/templates/someone-eating.jpg',
    exampleType: 'image',
    promptIntent:
      'Lifestyle moment with human hands or a person enjoying the dish. Natural, candid energy.',
    minPhotos: 1,
    maxPhotos: 1,
    requiredInputs: [
      { id: 'dish', label: 'Dish photo', description: 'The dish being enjoyed', required: true },
    ],
  },
]

const VIDEO_TEMPLATES: TemplateConfig[] = [
  {
    id: 'slow-reveal',
    label: 'Slow Reveal',
    description: 'Gentle motion that introduces the dish',
    type: 'video',
    examplePreview: '/templates/slow-reveal.mp4',
    exampleType: 'video',
    promptIntent:
      'Controlled camera movement reveals the hero subject gradually. No zooming. Steady drift.',
    minPhotos: 1,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'Starting frame for the reveal',
        required: true,
      },
    ],
  },
  {
    id: 'side-pass',
    label: 'Side Pass',
    description: 'Lateral camera movement',
    type: 'video',
    examplePreview: '/templates/side-pass.mp4',
    exampleType: 'video',
    promptIntent:
      'Smooth lateral slide past or alongside the dish. Subject holds center as camera passes.',
    minPhotos: 1,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'Dish for the lateral pass shot',
        required: true,
      },
    ],
  },
  {
    id: 'loop',
    label: 'Loop',
    description: 'Short reel-friendly loop',
    type: 'video',
    examplePreview: '/templates/loop.mp4',
    exampleType: 'video',
    promptIntent:
      'Motion designed to loop seamlessly. Start and end positions closely match. Rhythmic pacing.',
    minPhotos: 1,
    maxPhotos: 1,
    requiredInputs: [
      { id: 'dish', label: 'Dish photo', description: 'Source frame for the loop', required: true },
    ],
  },
  {
    id: 'dining-moment',
    label: 'Dining Moment',
    description: 'Human interaction or eating moment',
    type: 'video',
    examplePreview: '/templates/dining-moment.mp4',
    exampleType: 'video',
    promptIntent:
      'Scene includes a person enjoying the food. Natural, warm, candid. Not overly staged.',
    minPhotos: 1,
    maxPhotos: 1,
    requiredInputs: [
      { id: 'dish', label: 'Dish photo', description: 'The dish being enjoyed', required: true },
    ],
  },
]

const CAPTION_TEMPLATES: TemplateConfig[] = [
  {
    id: 'sensory',
    label: 'Sensory',
    description: 'Taste, texture, appetite-driven',
    type: 'caption',
    examplePreview:
      'Char on the outside. Silk on the inside. The kind of thing you keep thinking about on the drive home.',
    exampleType: 'caption',
    minPhotos: 0,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'Helps ground the sensory language',
        required: false,
      },
    ],
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean, restrained, no filler',
    type: 'caption',
    examplePreview: 'Worth the wait.',
    exampleType: 'caption',
    minPhotos: 0,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'Optional visual reference',
        required: false,
      },
    ],
  },
  {
    id: 'conversational',
    label: 'Conversational',
    description: 'Relatable, approachable',
    type: 'caption',
    examplePreview:
      'This is the one we keep coming back to. Simple, honest, and somehow better every time.',
    exampleType: 'caption',
    minPhotos: 0,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'Optional visual reference',
        required: false,
      },
    ],
  },
  {
    id: 'premium',
    label: 'Premium',
    description: 'Elevated, aspirational',
    type: 'caption',
    examplePreview:
      'A dish that rewards your attention. Every element considered, nothing accidental.',
    exampleType: 'caption',
    minPhotos: 0,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'Optional visual reference',
        required: false,
      },
    ],
  },
  {
    id: 'conversion',
    label: 'Conversion',
    description: 'Action-driven, CTA-focused',
    type: 'caption',
    examplePreview: 'On the menu tonight. Book your table before it sells out — link in bio.',
    exampleType: 'caption',
    minPhotos: 0,
    maxPhotos: 1,
    requiredInputs: [
      {
        id: 'dish',
        label: 'Dish photo',
        description: 'Optional visual reference',
        required: false,
      },
    ],
  },
]

const CAPTION_STYLE_MAP: Record<string, { tone: string; enthusiasm: string }> = {
  sensory: { tone: 'Playful', enthusiasm: 'Warm' },
  minimal: { tone: 'Professional', enthusiasm: 'Calm' },
  conversational: { tone: 'Friendly', enthusiasm: 'Warm' },
  premium: { tone: 'Professional', enthusiasm: 'Calm' },
  conversion: { tone: 'Bold', enthusiasm: 'Energetic' },
}

const MOOD_OPTIONS = ['Warm & cozy', 'Fresh & clean', 'Luxe & upscale', 'Bold & vibrant']
const LIGHTING_OPTIONS = ['Natural daylight', 'Golden hour', 'Moody/low-lit', 'Studio bright']
const SHOT_TYPE_OPTIONS = ['Close-up detail', 'Table scene', 'Overhead flat lay', 'Lifestyle']
const COLOR_PALETTE_OPTIONS = [
  'Earthy & neutral',
  'Cool & minimal',
  'Rich & saturated',
  'Dark & moody',
]
const TIME_OF_DAY_OPTIONS = ['Morning', 'Lunch', 'Evening', 'Night']
const CREATIVE_MODE_OPTIONS = ['Enhanced', 'Editorial', 'Cinematic']
const TONE_OPTIONS = ['Friendly', 'Professional', 'Playful', 'Bold']
const ENTHUSIASM_OPTIONS = ['Calm', 'Warm', 'Energetic', 'Excited']

// ─── Sub-components ────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: TemplateType }) {
  const config: Record<TemplateType, { label: string; className: string }> = {
    photo: { label: 'Photo', className: 'bg-violet-50 text-violet-700' },
    video: { label: 'Video', className: 'bg-blue-50 text-blue-700' },
    caption: { label: 'Caption', className: 'bg-amber-50 text-amber-700' },
  }
  const { label, className } = config[type]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}
    >
      {label}
    </span>
  )
}

function GalleryCard({ template, onClick }: { template: TemplateConfig; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-all hover:border-gray-400 hover:shadow-sm"
    >
      <div className="aspect-[3/4] w-full overflow-hidden">
        {template.exampleType === 'caption' ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-50 p-4">
            <p className="line-clamp-5 text-center text-[11px] leading-relaxed text-gray-500 italic">
              {template.examplePreview || 'Example caption preview'}
            </p>
          </div>
        ) : template.examplePreview ? (
          template.exampleType === 'video' ? (
            <video
              src={template.examplePreview}
              muted
              loop
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={template.examplePreview}
              alt={template.label}
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <span className="text-[10px] text-gray-400">No preview</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <span className="text-xs leading-snug font-semibold text-gray-900">{template.label}</span>
        <p className="mt-0.5 text-xs leading-snug text-gray-500">{template.description}</p>
        {template.maxPhotos > 1 && (
          <p className="mt-1 text-[10px] text-gray-400">
            {template.minPhotos}–{template.maxPhotos} photos
          </p>
        )}
      </div>
    </button>
  )
}

function InputSlotUpload({
  input,
  slot,
  onFile,
  onRemove,
  disabled,
}: {
  input: RequiredInput
  slot: PhotoSlot | undefined
  onFile: (file: File, preview: string) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    onFile(file, preview)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700">{input.label}</span>
        {input.required ? (
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
            Required
          </span>
        ) : (
          <span className="rounded-full bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
            Optional
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-gray-400">{input.description}</p>

      {slot ? (
        <div className="group relative">
          <img
            src={slot.preview}
            alt={input.label}
            className="h-32 w-full rounded-lg border border-gray-200 object-cover"
          />
          {!disabled && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <label className="cursor-pointer rounded bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">
                Replace
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleChange}
                  className="hidden"
                />
              </label>
              <button
                onClick={onRemove}
                className="rounded bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      ) : (
        <label
          className={[
            'flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center text-xs text-gray-400 transition-colors',
            disabled
              ? 'cursor-default border-gray-100 bg-gray-50'
              : 'border-gray-300 hover:border-gray-400',
          ].join(' ')}
        >
          {!disabled && (
            <>
              <span className="mb-1 text-gray-300">
                <Image size={20} strokeWidth={1.5} />
              </span>
              Click to upload
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleChange}
                disabled={disabled}
                className="hidden"
              />
            </>
          )}
        </label>
      )}
    </div>
  )
}

function SelectorRow({
  label,
  options,
  value,
  onChange,
  disabled,
  optional,
  optionTooltips,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  optional?: boolean
  optionTooltips?: Record<string, string>
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-gray-500">
        {label}
        {optional && <span className="ml-1 font-normal text-gray-400">(optional)</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const tip = optionTooltips?.[opt]
          const isSelected = value === opt
          return (
            <div key={opt} className="group relative">
              <button
                type="button"
                onClick={() => !disabled && onChange(isSelected ? '' : opt)}
                disabled={disabled}
                className={[
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  isSelected
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500',
                  disabled ? 'cursor-default opacity-60' : 'cursor-pointer',
                ].join(' ')}
              >
                {opt}
                {tip && (
                  <Info size={10} className={isSelected ? 'text-white/50' : 'text-gray-400'} />
                )}
              </button>
              {tip && (
                <div className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-56 rounded bg-gray-800 px-2.5 py-2 text-xs leading-relaxed text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {tip}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CampaignCreator({ brandId }: { brandId: string }) {
  const [activeTab, setActiveTab] = useState<'create' | 'archives'>('create')
  const [stage, setStage] = useState<Stage>('idle')
  const [postTopic, setPostTopic] = useState('')
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [captionResult, setCaptionResult] = useState<CaptionResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [regenImageLoading, setRegenImageLoading] = useState(false)
  const [regenCaptionLoading, setRegenCaptionLoading] = useState(false)
  const [archives, setArchives] = useState<ArchiveEntry[]>([])
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [directorBrief, setDirectorBrief] = useState<DirectorBrief | null>(null)
  const [outputTab, setOutputTab] = useState<OutputTabType>('outputs')

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig | null>(null)
  const [galleryTab, setGalleryTab] = useState<GalleryTab>('photo')

  // Named photo slots keyed by input id
  const [photoSlots, setPhotoSlots] = useState<Record<string, PhotoSlot>>({})
  // Uploaded slot URLs (post-upload, for regen)
  const [uploadedSlotUrls, setUploadedSlotUrls] = useState<Record<string, string>>({})

  // Caption options (for photo/video workflows that include a caption)
  const [includeCaption, setIncludeCaption] = useState(false)
  const [captionStyleId, setCaptionStyleId] = useState('')

  // Advanced controls
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [mood, setMood] = useState('')
  const [lighting, setLighting] = useState('')
  const [shotType, setShotType] = useState('')
  const [colorPalette, setColorPalette] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [creativeMode, setCreativeMode] = useState('')
  const [captionTone, setCaptionTone] = useState('')
  const [captionEnthusiasm, setCaptionEnthusiasm] = useState('')

  // Save modal
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [archiveName, setArchiveName] = useState('')
  const [archiveDescription, setArchiveDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingArchiveId, setDeletingArchiveId] = useState<string | null>(null)
  const [expandedModalArchiveId, setExpandedModalArchiveId] = useState<string | null>(null)

  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/archives')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setArchives(data))
      .catch(() => setArchives([]))
  }, [])

  // ─── Derived state ──────────────────────────────────────────────────────────

  const isLoading =
    stage === 'uploading' ||
    stage === 'generating' ||
    stage === 'captioning' ||
    stage === 'videoing'
  const isIdle = stage === 'idle'
  const hasOutputs = !!(resultUrl || captionResult || videoUrl)

  const generationOptions: GenerationOptions = {
    image: selectedTemplate?.type === 'photo',
    video: selectedTemplate?.type === 'video',
    caption: selectedTemplate !== null && includeCaption,
  }

  const resolvedCaptionStyle: { tone?: string; enthusiasm?: string } = captionStyleId
    ? (CAPTION_STYLE_MAP[captionStyleId] ?? {})
    : {}

  const captionStyle = {
    ...(captionTone || resolvedCaptionStyle.tone
      ? { tone: captionTone || resolvedCaptionStyle.tone }
      : {}),
    ...(captionEnthusiasm || resolvedCaptionStyle.enthusiasm
      ? { enthusiasm: captionEnthusiasm || resolvedCaptionStyle.enthusiasm }
      : {}),
  }

  const visualStyle = {
    mood: mood || undefined,
    lighting: lighting || undefined,
    shot_type: shotType || undefined,
    color_palette: colorPalette || undefined,
    time_of_day: timeOfDay || undefined,
    creative_mode: creativeMode ? (creativeMode.toLowerCase() as CreativeMode) : undefined,
  }

  const primaryInputId = selectedTemplate?.requiredInputs[0]?.id ?? null

  // URL of first required slot — used as image_url for generation APIs
  const primarySlotUrl = primaryInputId ? (uploadedSlotUrls[primaryInputId] ?? null) : null

  const requiredSlotsFilled =
    selectedTemplate !== null &&
    selectedTemplate.requiredInputs.filter((i) => i.required).every((i) => !!photoSlots[i.id])

  const captionRequirements =
    !generationOptions.caption || (postTopic.trim().length > 0 && !!captionStyleId)

  const canGenerate =
    selectedTemplate !== null &&
    (selectedTemplate.minPhotos === 0 || requiredSlotsFilled) &&
    captionRequirements

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function selectTemplate(template: TemplateConfig) {
    setSelectedTemplate(template)
    setPhotoSlots({})
    setUploadedSlotUrls({})
    setIncludeCaption(false)
    setCaptionStyleId('')
    setAdvancedOpen(false)
    setError('')
  }

  function clearTemplate() {
    setSelectedTemplate(null)
    setPhotoSlots({})
    setUploadedSlotUrls({})
    setIncludeCaption(false)
    setCaptionStyleId('')
    setError('')
    setStage('idle')
  }

  function handleSlotFile(inputId: string, file: File, preview: string) {
    setPhotoSlots((prev) => ({ ...prev, [inputId]: { file, preview } }))
  }

  function handleSlotRemove(inputId: string) {
    setPhotoSlots((prev) => {
      const next = { ...prev }
      delete next[inputId]
      return next
    })
  }

  async function runGenerationSteps(cId: string, primaryUrl: string | null) {
    let freshImageUrl: string | null = null
    let freshBrief: DirectorBrief | null = null

    if (generationOptions.image) {
      setStage('generating')
      const res = await fetch(`/api/campaigns/${cId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: primaryUrl,
          visual_style: visualStyle,
          photo_template: selectedTemplate?.id || undefined,
          prompt_intent: selectedTemplate?.promptIntent || undefined,
        }),
      })
      if (!res.ok) throw new Error('Image generation failed')
      const data = await res.json()
      freshImageUrl = data.asset_url
      freshBrief = data.director_brief ?? null
      setResultUrl(`${data.asset_url}?t=${Date.now()}`)
      setDirectorBrief(freshBrief)
    }

    if (generationOptions.caption) {
      setStage('captioning')
      const res = await fetch(`/api/campaigns/${cId}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: primaryUrl ?? null,
          caption_style: captionStyle,
          post_topic: postTopic || undefined,
        }),
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
          image_url: freshImageUrl ?? resultUrl ?? primaryUrl,
          director_brief: freshBrief ?? directorBrief ?? null,
          visual_style: visualStyle,
          video_template: selectedTemplate?.id || undefined,
          prompt_intent: selectedTemplate?.promptIntent || undefined,
        }),
      })
      if (!res.ok) throw new Error('Video generation failed')
      const { asset_url } = await res.json()
      setVideoUrl(`${asset_url}?t=${Date.now()}`)
    }
  }

  async function handleGenerate() {
    if (!canGenerate || !selectedTemplate) return
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

      const slotUrls: Record<string, string> = {}

      if (selectedTemplate.maxPhotos > 0) {
        setStage('uploading')
        for (const input of selectedTemplate.requiredInputs) {
          const slot = photoSlots[input.id]
          if (!slot) continue
          const formData = new FormData()
          formData.append('file', slot.file)
          formData.append('campaign_id', campaign.id)
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
          if (!uploadRes.ok && input.required) throw new Error('Failed to upload photo')
          if (uploadRes.ok) {
            const { url } = await uploadRes.json()
            slotUrls[input.id] = url
          }
        }
        setUploadedSlotUrls(slotUrls)
      }

      const primaryUrl = primaryInputId ? (slotUrls[primaryInputId] ?? null) : null
      await runGenerationSteps(campaign.id, primaryUrl)
      setStage('done')
    } catch (err) {
      setError(getErrorMessage(err))
      setStage('error')
    }
  }

  function handleNewCampaign() {
    setStage('idle')
    setCampaignId(null)
    setUploadedSlotUrls({})
    setPhotoSlots({})
    setPostTopic('')
    setResultUrl(null)
    setCaptionResult(null)
    setVideoUrl(null)
    setDirectorBrief(null)
    setSelectedTemplate(null)
    setIncludeCaption(false)
    setCaptionStyleId('')
    setAdvancedOpen(false)
    setCreativeMode('')
    setError('')
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleRegenImage() {
    if (!campaignId) return
    setRegenImageLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: primarySlotUrl,
          visual_style: visualStyle,
          photo_template: selectedTemplate?.id || undefined,
          prompt_intent: selectedTemplate?.promptIntent || undefined,
        }),
      })
      if (!res.ok) throw new Error('Image regeneration failed')
      const { asset_url } = await res.json()
      setResultUrl(`${asset_url}?t=${Date.now()}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setRegenImageLoading(false)
    }
  }

  function handleDownloadImage() {
    if (!resultUrl) return
    downloadFile(resultUrl, 'enhanced-product.jpg')
  }

  function handleDownloadVideo() {
    if (!videoUrl) return
    downloadFile(videoUrl, 'campaign-video.mp4')
  }

  async function handleRegenCaption() {
    if (!campaignId) return
    setRegenCaptionLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: primarySlotUrl ?? null,
          caption_style: captionStyle,
          post_topic: postTopic || undefined,
        }),
      })
      if (!res.ok) throw new Error('Caption regeneration failed')
      setCaptionResult(await res.json())
    } catch (err) {
      setError(getErrorMessage(err))
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
          image_url: resultUrl ?? primarySlotUrl,
          director_brief: directorBrief ?? null,
          visual_style: visualStyle,
          video_template: selectedTemplate?.id || undefined,
          prompt_intent: selectedTemplate?.promptIntent || undefined,
        }),
      })
      if (!res.ok) throw new Error('Video regeneration failed')
      const { asset_url } = await res.json()
      setVideoUrl(`${asset_url}?t=${Date.now()}`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setVideoLoading(false)
    }
  }

  function downloadFile(url: string, filename: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function getErrorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Something went wrong'
  }

  function formatArchiveDate(dateStr: string, includeYear = true): string {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const currentYear = new Date().getFullYear()
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: includeYear && year !== currentYear ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  async function handleCopy() {
    if (!captionResult) return
    const hashtags = captionResult.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')
    await navigator.clipboard.writeText(`${captionResult.caption}\n\n${hashtags}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownloadAll() {
    if (resultUrl) downloadFile(resultUrl, 'enhanced-product.jpg')
    if (videoUrl) downloadFile(videoUrl, 'campaign-video.mp4')
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
      const updatedArchives = await fetch('/api/archives').then((r) => (r.ok ? r.json() : []))
      setArchives(updatedArchives)
    } catch (err) {
      setSaveError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteFromModal(id: string) {
    setDeletingArchiveId(id)
    try {
      await fetch(`/api/archives/${id}`, { method: 'DELETE' })
      setSaveError('')
      setArchives((prev) => prev.filter((a) => a.id !== id))
    } finally {
      setDeletingArchiveId(null)
    }
  }

  const inputsLocked = !isIdle

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'create'
              ? 'border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Create
        </button>
        <button
          onClick={() => setActiveTab('archives')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'archives'
              ? 'border-b-2 border-gray-900 text-gray-900'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Archives{' '}
          <span className={archives.length >= 5 ? 'text-amber-600' : ''}>
            ({archives.length}/5)
          </span>
        </button>
      </div>

      {/* Create tab */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          <Card className="p-6" ref={cardRef}>
            {/* ── Gallery view ─────────────────────────────────────────────── */}
            {!selectedTemplate && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Choose a template to shape the look of your content — then upload a photo and
                  we&apos;ll handle the rest.
                </p>
                {/* Gallery tabs */}
                <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
                  {[
                    { key: 'photo' as GalleryTab, label: 'Photo' },
                    { key: 'video' as GalleryTab, label: 'Video' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setGalleryTab(key)}
                      className={[
                        'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                        galleryTab === key
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Template grid */}
                <div className="grid grid-cols-2 gap-2">
                  {(galleryTab === 'photo' ? PHOTO_TEMPLATES : VIDEO_TEMPLATES).map((t) => (
                    <GalleryCard key={t.id} template={t} onClick={() => selectTemplate(t)} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Workflow view ─────────────────────────────────────────────── */}
            {selectedTemplate && (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start gap-3">
                  {!inputsLocked && (
                    <button
                      onClick={clearTemplate}
                      className="mt-0.5 text-gray-400 hover:text-gray-700"
                      aria-label="Back to templates"
                    >
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {selectedTemplate.label}
                      </h3>
                      <TypeBadge type={selectedTemplate.type} />
                    </div>
                    <p className="text-xs text-gray-500">{selectedTemplate.description}</p>
                  </div>
                </div>

                {/* Photo inputs */}
                {selectedTemplate.requiredInputs.length > 0 && selectedTemplate.maxPhotos > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-medium text-gray-500">
                      {selectedTemplate.type === 'caption' ? 'Photo reference' : 'Photos'}
                    </p>
                    {selectedTemplate.requiredInputs.map((input) => (
                      <InputSlotUpload
                        key={input.id}
                        input={input}
                        slot={photoSlots[input.id]}
                        onFile={(file, preview) => handleSlotFile(input.id, file, preview)}
                        onRemove={() => handleSlotRemove(input.id)}
                        disabled={inputsLocked}
                      />
                    ))}
                  </div>
                )}

                {/* Caption section */}
                <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-700">Include caption</p>
                      <p className="text-xs text-gray-400">
                        Generate an Instagram caption alongside
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => !inputsLocked && setIncludeCaption((v) => !v)}
                      disabled={inputsLocked}
                      className={[
                        'relative h-5 w-9 rounded-full transition-colors',
                        includeCaption ? 'bg-gray-900' : 'bg-gray-300',
                        inputsLocked ? 'cursor-default opacity-60' : 'cursor-pointer',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                          includeCaption ? 'left-4' : 'left-0.5',
                        ].join(' ')}
                      />
                    </button>
                  </div>

                  {includeCaption && (
                    <div className="space-y-4 pt-1">
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500">Caption style</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {CAPTION_TEMPLATES.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() =>
                                !inputsLocked &&
                                setCaptionStyleId(captionStyleId === s.id ? '' : s.id)
                              }
                              disabled={inputsLocked}
                              className={[
                                'relative flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors',
                                captionStyleId === s.id
                                  ? 'border-gray-900 bg-gray-900 text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400',
                                inputsLocked ? 'cursor-default opacity-60' : 'cursor-pointer',
                              ].join(' ')}
                            >
                              <span
                                className={`text-xs font-semibold ${captionStyleId === s.id ? 'text-white' : 'text-gray-900'}`}
                              >
                                {s.label}
                              </span>
                              <span
                                className={`text-xs ${captionStyleId === s.id ? 'text-white/70' : 'text-gray-500'}`}
                              >
                                {s.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="mb-1.5 text-xs font-medium text-gray-500">
                          What is this post about?{' '}
                          <span className="font-normal text-gray-400">(required)</span>
                        </p>
                        <textarea
                          placeholder="e.g. New truffle pizza launch"
                          value={postTopic}
                          onChange={(e) => setPostTopic(e.target.value)}
                          readOnly={inputsLocked}
                          rows={2}
                          className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2 text-sm read-only:cursor-default read-only:bg-gray-50 read-only:text-gray-500 focus:ring-2 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Advanced controls */}
                <div>
                  <button
                    type="button"
                    onClick={() => !inputsLocked && setAdvancedOpen((v) => !v)}
                    disabled={inputsLocked}
                    className="flex w-full items-center justify-between text-xs font-medium text-gray-400 hover:text-gray-600 disabled:cursor-default disabled:opacity-60"
                  >
                    <span>Advanced controls</span>
                    {advancedOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {advancedOpen && (
                    <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
                      {selectedTemplate.type !== 'caption' && (
                        <>
                          <SelectorRow
                            label="Mood"
                            options={MOOD_OPTIONS}
                            value={mood}
                            onChange={setMood}
                            disabled={inputsLocked}
                            optional
                          />
                          <SelectorRow
                            label="Lighting"
                            options={LIGHTING_OPTIONS}
                            value={lighting}
                            onChange={setLighting}
                            disabled={inputsLocked}
                            optional
                          />
                          <SelectorRow
                            label="Shot type"
                            options={SHOT_TYPE_OPTIONS}
                            value={shotType}
                            onChange={setShotType}
                            disabled={inputsLocked}
                            optional
                          />
                          <SelectorRow
                            label="Color palette"
                            options={COLOR_PALETTE_OPTIONS}
                            value={colorPalette}
                            onChange={setColorPalette}
                            disabled={inputsLocked}
                            optional
                          />
                          <SelectorRow
                            label="Time of day"
                            options={TIME_OF_DAY_OPTIONS}
                            value={timeOfDay}
                            onChange={setTimeOfDay}
                            disabled={inputsLocked}
                            optional
                          />
                          <SelectorRow
                            label="Creative mode"
                            options={CREATIVE_MODE_OPTIONS}
                            value={creativeMode}
                            onChange={setCreativeMode}
                            disabled={inputsLocked}
                            optional
                            optionTooltips={{
                              Enhanced:
                                'Same photo, retoucher-level pass. Original scene preserved exactly — relit, refined, and finished beyond what phone editing can do.',
                              Editorial:
                                'Same dish, magazine reshoot. Fresh plating, new surface, new lighting design, distinct aesthetic identity. Like a food stylist restaged it.',
                              Cinematic:
                                'Same dish, campaign production. Bespoke scene with lifestyle props, atmospheric storytelling, and narrative composition. TV commercial energy.',
                            }}
                          />
                        </>
                      )}
                      {generationOptions.caption && (
                        <>
                          {selectedTemplate.type !== 'caption' && (
                            <hr className="border-gray-100" />
                          )}
                          <SelectorRow
                            label="Tone"
                            options={TONE_OPTIONS}
                            value={captionTone}
                            onChange={setCaptionTone}
                            disabled={inputsLocked}
                            optional
                          />
                          <SelectorRow
                            label="Energy"
                            options={ENTHUSIASM_OPTIONS}
                            value={captionEnthusiasm}
                            onChange={setCaptionEnthusiasm}
                            disabled={inputsLocked}
                            optional
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Loading state */}
                {isLoading && (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {stage === 'uploading' && 'Uploading image...'}
                          {stage === 'generating' && 'Generating image...'}
                          {stage === 'captioning' && 'Writing captions...'}
                          {stage === 'videoing' && 'Creating videos...'}
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="h-48 animate-pulse rounded bg-gray-100" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Output tabs */}
                {stage === 'done' && hasOutputs && (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    {/* Tab buttons */}
                    <div className="flex border-b border-gray-200">
                      <button
                        onClick={() => setOutputTab('outputs')}
                        className={[
                          'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                          outputTab === 'outputs'
                            ? 'border-b-2 border-gray-900 text-gray-900'
                            : 'text-gray-600 hover:text-gray-900',
                        ].join(' ')}
                      >
                        Outputs
                      </button>
                      <button
                        onClick={() => setOutputTab('previews')}
                        className={[
                          'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                          outputTab === 'previews'
                            ? 'border-b-2 border-gray-900 text-gray-900'
                            : 'text-gray-600 hover:text-gray-900',
                        ].join(' ')}
                      >
                        Previews
                      </button>
                    </div>

                    {/* Tab content */}
                    <div className="p-6">
                      {outputTab === 'outputs' && (
                        <div className="space-y-6">
                          {/* Image output */}
                          {resultUrl && (
                            <div>
                              <p className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
                                Image
                              </p>
                              <div className="space-y-3">
                                <div className="overflow-hidden rounded border bg-gray-50">
                                  <img
                                    src={resultUrl}
                                    alt="Enhanced"
                                    className="h-auto w-full object-cover"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenImage}
                                    disabled={regenImageLoading}
                                    className="flex-1"
                                  >
                                    {regenImageLoading ? 'Regenerating...' : 'Regenerate'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownloadImage}
                                    className="flex-1"
                                  >
                                    Download
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Caption output */}
                          {captionResult && (
                            <div>
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                                  Caption
                                </p>
                                <button
                                  onClick={handleCopy}
                                  className="rounded p-1 hover:bg-gray-100"
                                  title={copied ? 'Copied!' : 'Copy caption and hashtags'}
                                >
                                  <Copy
                                    size={16}
                                    className={copied ? 'text-green-600' : 'text-gray-400'}
                                  />
                                </button>
                              </div>
                              <div className="space-y-3">
                                <div className="rounded border bg-gray-50 p-4">
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
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenCaption}
                                    disabled={regenCaptionLoading}
                                    className="flex-1"
                                  >
                                    {regenCaptionLoading ? 'Regenerating...' : 'Regenerate'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Video output */}
                          {videoUrl && (
                            <div>
                              <p className="mb-3 text-xs font-medium tracking-wide text-gray-500 uppercase">
                                Video
                              </p>
                              <div className="space-y-3">
                                <div className="overflow-hidden rounded border bg-gray-50">
                                  <video src={videoUrl} controls className="h-auto w-full" />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRegenVideo}
                                    disabled={videoLoading}
                                    className="flex-1"
                                  >
                                    {videoLoading ? 'Regenerating...' : 'Regenerate'}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleDownloadVideo}
                                    className="flex-1"
                                  >
                                    Download
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {outputTab === 'previews' && (resultUrl || videoUrl) && (
                        <SocialMockups
                          imageUrl={resultUrl}
                          videoUrl={videoUrl}
                          caption={captionResult?.caption}
                          hashtags={captionResult?.hashtags}
                        />
                      )}
                    </div>
                  </div>
                )}

                {isIdle && (
                  <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full">
                    Generate
                  </Button>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                {/* Action bar */}
                {stage === 'done' && hasOutputs && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setSaveError('')
                        setSaveModalOpen(true)
                      }}
                      className="flex-1"
                    >
                      Save to Archive
                    </Button>
                    <Button onClick={handleDownloadAll} variant="outline" className="flex-1">
                      Download
                    </Button>
                    <Button
                      onClick={handleNewCampaign}
                      disabled={isLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      New Campaign
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Archives tab */}
      {activeTab === 'archives' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Saved campaigns. Download assets or revisit past content any time.
          </p>
          {archives.length === 0 ? (
            <Card className="p-6">
              <p className="text-center text-gray-500">
                No archived campaigns yet. Create and save a campaign to see it here.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {archives.map((archive) => {
                const created = formatArchiveDate(archive.created_at)
                return (
                  <Card key={archive.id} className="overflow-hidden p-6">
                    <div className="flex gap-4">
                      {archive.image_url && (
                        <div className="h-24 w-24 flex-shrink-0">
                          <img
                            src={archive.image_url}
                            alt={archive.name}
                            className="h-full w-full rounded object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{archive.name}</h3>
                        {archive.description && (
                          <p className="mt-1 text-sm text-gray-600">{archive.description}</p>
                        )}
                        {archive.caption && (
                          <p className="mt-2 line-clamp-2 text-xs text-gray-500">
                            {archive.caption}
                          </p>
                        )}
                        <p className="mt-3 text-xs text-gray-400">{created}</p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={deletingArchiveId === archive.id}
                          onClick={() => handleDeleteFromModal(archive.id)}
                        >
                          {deletingArchiveId === archive.id ? 'Deleting...' : 'Delete'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Save modal */}
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
                        const created = formatArchiveDate(a.created_at, false)
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
