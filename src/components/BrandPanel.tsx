'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const VOICE_PRESETS = [
  'Warm & Local',
  'Premium & Refined',
  'Playful & Fun',
  'Professional & Trustworthy',
  'Energetic & Bold',
  'Artisanal & Authentic',
  'Casual & Approachable',
]

interface BrandPanelProps {
  id: string
  name: string
  description: string
  brand_voice?: string
}

export function BrandPanel({ id, name, description, brand_voice = '' }: BrandPanelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [nameVal, setNameVal] = useState(name)
  const [descVal, setDescVal] = useState(description)
  const [voicePreset, setVoicePreset] = useState(
    VOICE_PRESETS.find((p) => brand_voice?.includes(p)) || '',
  )
  const [voiceCustom, setVoiceCustom] = useState(
    brand_voice?.replace(VOICE_PRESETS.find((p) => brand_voice?.includes(p)) || '', '').trim() ||
      '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setLoading(true)
    setError('')

    try {
      const brandVoice = voicePreset
        ? `${voicePreset}${voiceCustom ? '. ' + voiceCustom : ''}`
        : voiceCustom
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameVal, description: descVal, brand_voice: brandVoice }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save')
      }

      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setNameVal(name)
    setDescVal(description)
    setVoicePreset(VOICE_PRESETS.find((p) => brand_voice?.includes(p)) || '')
    setVoiceCustom(
      brand_voice?.replace(VOICE_PRESETS.find((p) => brand_voice?.includes(p)) || '', '').trim() ||
        '',
    )
    setError('')
    setIsEditing(false)
  }

  if (!isEditing) {
    return (
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Brand</h2>
          <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
            Edit
          </Button>
        </div>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold text-gray-700">{nameVal}</p>
          </div>
          <div>
            <p className="text-gray-600">{descVal || '—'}</p>
          </div>
          {voicePreset && (
            <div>
              <p className="text-gray-600">
                <span className="font-semibold">{voicePreset}</span>
                {voiceCustom && `. ${voiceCustom}`}
              </p>
            </div>
          )}
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-xl font-bold">Brand</h2>
      <div className="space-y-4">
        <div>
          <Label htmlFor="brand-name">Brand Name</Label>
          <Input
            id="brand-name"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="brand-desc">Description</Label>
          <textarea
            id="brand-desc"
            value={descVal}
            onChange={(e) => setDescVal(e.target.value)}
            rows={3}
            className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        <div>
          <Label htmlFor="brand-voice-preset">Brand Voice</Label>
          <select
            id="brand-voice-preset"
            value={voicePreset}
            onChange={(e) => setVoicePreset(e.target.value)}
            className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          >
            <option value="">Select a tone...</option>
            {VOICE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="brand-voice-custom">Voice Details (optional)</Label>
          <textarea
            id="brand-voice-custom"
            value={voiceCustom}
            onChange={(e) => setVoiceCustom(e.target.value)}
            rows={2}
            placeholder="e.g., We use humor, emphasize freshness and quality, avoid corporate jargon"
            className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={loading} className="flex-1">
            Reset
          </Button>
        </div>
      </div>
    </Card>
  )
}
