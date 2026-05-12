'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const BRAND_VOICE_PRESETS = [
  'Friendly and approachable',
  'Professional and upscale',
  'Playful and humorous',
  'Minimalist and modern',
  'Warm and community-focused',
  'Bold and trendsetting',
  'Custom',
]

function SetupBrandContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const brandId = searchParams.get('brandId')

  const [description, setDescription] = useState('')
  const [brandVoicePreset, setBrandVoicePreset] = useState('')
  const [brandVoiceDetails, setBrandVoiceDetails] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!brandId) {
      router.push('/auth/signup')
    }
  }, [brandId, router])

  async function handleSkip() {
    router.push('/')
  }

  async function handleSetupBrand(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const brandVoice =
        brandVoicePreset === 'Custom'
          ? brandVoiceDetails
          : `${brandVoicePreset}${brandVoiceDetails ? '. ' + brandVoiceDetails : ''}`

      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description || null,
          brand_voice: brandVoice || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Failed to setup brand')
        return
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!brandId) {
    return null
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="max-w-sm p-6">
        <h1 className="mb-6 text-2xl font-bold">Set Up Your Brand</h1>

        <form onSubmit={handleSetupBrand} className="space-y-4">
          <div>
            <Label htmlFor="description">Brand Description</Label>
            <textarea
              id="description"
              placeholder="e.g., Luna Cafe is a cozy neighborhood coffee shop specializing in single-origin espresso and seasonal pastries."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="brand-voice">Brand Voice</Label>
            <select
              id="brand-voice"
              value={brandVoicePreset}
              onChange={(e) => setBrandVoicePreset(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
            >
              <option value="">Select a voice style</option>
              {BRAND_VOICE_PRESETS.map((preset) => (
                <option key={preset} value={preset}>
                  {preset}
                </option>
              ))}
            </select>
          </div>

          {brandVoicePreset && (
            <div>
              <Label htmlFor="brand-voice-details">Voice Details</Label>
              <textarea
                id="brand-voice-details"
                placeholder="e.g., We use humor, emphasize freshness and quality, avoid corporate jargon"
                value={brandVoiceDetails}
                onChange={(e) => setBrandVoiceDetails(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                rows={2}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={handleSkip}
              disabled={loading}
              variant="outline"
              className="flex-1"
            >
              Skip
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Setting up...' : 'Continue'}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  )
}

export default function SetupBrandPage() {
  return (
    <Suspense fallback={null}>
      <SetupBrandContent />
    </Suspense>
  )
}
