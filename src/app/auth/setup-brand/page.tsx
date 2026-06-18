'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  BUSINESS_TYPES,
  FOOD_DRINK_OPTIONS,
  BUSINESS_TYPE_FOOD_RELEVANCE,
  ATMOSPHERE_OPTIONS,
  PERSONALITY_OPTIONS,
  MAX_PERSONALITY,
} from '@/data/brand-options'

// ─── Combobox ─────────────────────────────────────────────────────────────────

function Combobox({
  options,
  relevantOptions,
  value,
  onChange,
  placeholder,
  id,
}: {
  options: string[]
  relevantOptions?: string[]
  value: string
  onChange: (v: string) => void
  placeholder: string
  id: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const query = value.toLowerCase()

  const relevant = relevantOptions ?? []
  const others = options.filter((o) => !relevant.includes(o))

  const filteredRelevant = relevant.filter((o) => o.toLowerCase().includes(query))
  const filteredOthers = others.filter((o) => o.toLowerCase().includes(query))
  const hasResults = filteredRelevant.length > 0 || filteredOthers.length > 0
  const sectioned = relevant.length > 0

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function renderOption(opt: string, greyed = false) {
    return (
      <li
        key={opt}
        onMouseDown={(e) => {
          e.preventDefault()
          onChange(opt)
          setOpen(false)
        }}
        className={`cursor-pointer px-3 py-2 text-sm hover:bg-gray-50 ${greyed ? 'text-gray-400' : 'text-gray-900'}`}
      >
        {opt}
      </li>
    )
  }

  return (
    <div ref={ref} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1"
      />
      {open && hasResults && (
        <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {sectioned ? (
            <>
              {filteredRelevant.length > 0 && (
                <>
                  <li className="px-3 py-1.5 text-xs font-medium tracking-wide text-gray-400 uppercase">
                    Relevant
                  </li>
                  {filteredRelevant.map((o) => renderOption(o))}
                </>
              )}
              {filteredOthers.length > 0 && (
                <>
                  <li className="mt-1 border-t border-gray-100 px-3 py-1.5 text-xs font-medium tracking-wide text-gray-400 uppercase">
                    Other options
                  </li>
                  {filteredOthers.map((o) => renderOption(o, true))}
                </>
              )}
            </>
          ) : (
            [...filteredRelevant, ...filteredOthers].map((o) => renderOption(o))
          )}
        </ul>
      )}
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        selected
          ? 'border-gray-900 bg-gray-900 text-white'
          : disabled
            ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Progress ─────────────────────────────────────────────────────────────────

function ProgressDots({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-6 flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${step === 1 ? 'bg-gray-900' : 'bg-gray-300'}`} />
      <div className={`h-2 w-2 rounded-full ${step === 2 ? 'bg-gray-900' : 'bg-gray-300'}`} />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function SetupBrandContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const brandId = searchParams.get('brandId')

  const [step, setStep] = useState<1 | 2>(1)
  const [initialLoading, setInitialLoading] = useState(true)

  // Step 1
  const [brandName, setBrandName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [foodDrinkType, setFoodDrinkType] = useState('')

  // Step 2
  const [location, setLocation] = useState('')
  const [atmosphere, setAtmosphere] = useState<string[]>([])
  const [personality, setPersonality] = useState<string[]>([])
  const [description, setDescription] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!brandId) {
      router.push('/auth/signup')
      return
    }
    fetch(`/api/brands/${brandId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.name) setBrandName(data.name)
      })
      .finally(() => setInitialLoading(false))
  }, [brandId, router])

  const step1Valid = brandName.trim() && businessType && foodDrinkType.trim()

  const step2HasAnyValue =
    location.trim() || atmosphere.length > 0 || personality.length > 0 || description.trim()

  function toggleAtmosphere(val: string) {
    setAtmosphere((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]))
  }

  function togglePersonality(val: string) {
    setPersonality((prev) => {
      if (prev.includes(val)) return prev.filter((v) => v !== val)
      if (prev.length >= MAX_PERSONALITY) return prev
      return [...prev, val]
    })
  }

  async function handleSubmit() {
    if (!brandId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brandName.trim(),
          business_type: businessType,
          food_drink_type: foodDrinkType.trim(),
          location: location.trim() || null,
          atmosphere: atmosphere.length ? atmosphere : null,
          personality: personality.length ? personality : null,
          description: description.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to save')
      }

      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!brandId || initialLoading) return null

  // ─── Step 1 ───────────────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md p-8">
          <ProgressDots step={1} />
          <h1 className="mb-1 text-2xl font-bold text-gray-900">Tell us about your place</h1>
          <p className="mb-6 text-sm text-gray-500">Step 1 of 2</p>

          <div className="space-y-5">
            <div>
              <Label htmlFor="brand-name">Brand name *</Label>
              <Input
                id="brand-name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="e.g. The Corner Table"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="business-type">Type of business *</Label>
              <select
                id="business-type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Select type</option>
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="food-drink-type">Food & drink type *</Label>
              <Combobox
                id="food-drink-type"
                options={FOOD_DRINK_OPTIONS}
                relevantOptions={BUSINESS_TYPE_FOOD_RELEVANCE[businessType] ?? []}
                value={foodDrinkType}
                onChange={setFoodDrinkType}
                placeholder="e.g. Italian, Cocktail Bar, Fusion…"
              />
            </div>

            <Button onClick={() => setStep(2)} disabled={!step1Valid} className="w-full">
              Continue →
            </Button>
          </div>
        </Card>
      </main>
    )
  }

  // ─── Step 2 ───────────────────────────────────────────────────────────────

  return (
    <main className="flex min-h-screen items-start justify-center bg-gray-100 p-4 pt-12">
      <div className="w-full max-w-md">
        <ProgressDots step={2} />
        <h1 className="mb-1 text-2xl font-bold text-gray-900">What&apos;s your vibe?</h1>
        <p className="mb-6 text-sm text-gray-500">
          Step 2 of 2 · These details help generate content that actually looks and sounds like you.
        </p>

        <div className="space-y-4">
          <Card className="p-4">
            <Label htmlFor="location" className="text-sm font-medium">
              Where are you based?
            </Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. San Francisco, CA"
              className="mt-2"
            />
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-sm font-medium text-gray-900">Atmosphere</p>
            <div className="flex flex-wrap gap-2">
              {ATMOSPHERE_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={atmosphere.includes(opt)}
                  onClick={() => toggleAtmosphere(opt)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-1 text-sm font-medium text-gray-900">Brand personality</p>
            <p className="mb-3 text-xs text-gray-500">Pick up to {MAX_PERSONALITY}</p>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_OPTIONS.map((opt) => (
                <Chip
                  key={opt}
                  label={opt}
                  selected={personality.includes(opt)}
                  disabled={!personality.includes(opt) && personality.length >= MAX_PERSONALITY}
                  onClick={() => togglePersonality(opt)}
                />
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <Label htmlFor="description" className="text-sm font-medium">
              What makes you unique?
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="e.g. Family-owned since 1987, known for our 72-hour slow-braised Sunday ragù. Regulars come back for the neighborhood feel as much as the food."
              className="border-input mt-2 w-full rounded-md border px-3 py-2 text-sm"
            />
          </Card>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(1)} disabled={loading}>
            ← Back
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant={step2HasAnyValue ? 'default' : 'outline'}
          >
            {loading ? 'Saving…' : step2HasAnyValue ? 'Complete setup →' : 'Skip for now'}
          </Button>
        </div>
      </div>
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
