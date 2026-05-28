'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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

// ─── BrandPanel ───────────────────────────────────────────────────────────────

interface BrandPanelProps {
  id: string
  name: string
  description: string
  business_type: string
  food_drink_type: string
  location: string
  atmosphere: string[]
  personality: string[]
}

export function BrandPanel({
  id,
  name,
  description,
  business_type,
  food_drink_type,
  location,
  atmosphere,
  personality,
}: BrandPanelProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)

  const [nameVal, setNameVal] = useState(name)
  const [businessTypeVal, setBusinessTypeVal] = useState(business_type)
  const [foodDrinkTypeVal, setFoodDrinkTypeVal] = useState(food_drink_type)
  const [locationVal, setLocationVal] = useState(location)
  const [atmosphereVal, setAtmosphereVal] = useState<string[]>(atmosphere)
  const [personalityVal, setPersonalityVal] = useState<string[]>(personality)
  const [descVal, setDescVal] = useState(description)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function toggleAtmosphere(val: string) {
    setAtmosphereVal((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    )
  }

  function togglePersonality(val: string) {
    setPersonalityVal((prev) => {
      if (prev.includes(val)) return prev.filter((v) => v !== val)
      if (prev.length >= MAX_PERSONALITY) return prev
      return [...prev, val]
    })
  }

  async function handleSave() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameVal,
          description: descVal,
          business_type: businessTypeVal,
          food_drink_type: foodDrinkTypeVal,
          location: locationVal,
          atmosphere: atmosphereVal,
          personality: personalityVal,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save')
      }

      setIsEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setNameVal(name)
    setBusinessTypeVal(business_type)
    setFoodDrinkTypeVal(food_drink_type)
    setLocationVal(location)
    setAtmosphereVal(atmosphere)
    setPersonalityVal(personality)
    setDescVal(description)
    setError('')
    setIsEditing(false)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to delete')
      }
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/auth/login')
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleting(false)
    }
  }

  // ─── Read view ──────────────────────────────────────────────────────────────

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Brand Info</h2>
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              Edit
            </Button>
          </div>

          <div className="space-y-4 text-sm">
            <Field label="Brand Name" value={nameVal} />
            <Field label="Type of Business" value={businessTypeVal} />
            <Field label="Food & Drink Type" value={foodDrinkTypeVal} />
            <Field label="Location" value={locationVal} />

            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-gray-400 uppercase">
                Atmosphere
              </p>
              {atmosphereVal.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {atmosphereVal.map((a) => (
                    <span
                      key={a}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">—</p>
              )}
            </div>

            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-gray-400 uppercase">
                Brand Personality
              </p>
              {personalityVal.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {personalityVal.map((p) => (
                    <span
                      key={p}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">—</p>
              )}
            </div>

            <Field label="What Makes You Unique" value={descVal} multiline />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Account</h2>
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="outline"
            disabled={deleting}
            className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            Delete Account
          </Button>

          {showDeleteConfirm && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="mb-2 text-xs font-medium text-red-900">
                Delete &quot;{nameVal}&quot;? Cannot undo.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    )
  }

  // ─── Edit view ──────────────────────────────────────────────────────────────

  return (
    <Card className="p-6">
      <h2 className="mb-5 text-lg font-semibold text-gray-900">Edit Brand Info</h2>

      <div className="space-y-5">
        <div>
          <Label htmlFor="bp-name">Brand Name</Label>
          <Input
            id="bp-name"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="bp-business-type">Type of Business</Label>
          <select
            id="bp-business-type"
            value={businessTypeVal}
            onChange={(e) => setBusinessTypeVal(e.target.value)}
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
          <Label htmlFor="bp-food-drink">Food & Drink Type</Label>
          <Combobox
            id="bp-food-drink"
            options={FOOD_DRINK_OPTIONS}
            relevantOptions={BUSINESS_TYPE_FOOD_RELEVANCE[businessTypeVal] ?? []}
            value={foodDrinkTypeVal}
            onChange={setFoodDrinkTypeVal}
            placeholder="e.g. Italian, Cocktail Bar, Fusion…"
          />
        </div>

        <div>
          <Label htmlFor="bp-location">Location</Label>
          <Input
            id="bp-location"
            value={locationVal}
            onChange={(e) => setLocationVal(e.target.value)}
            placeholder="e.g. San Francisco, CA"
            className="mt-1"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Atmosphere</p>
          <div className="flex flex-wrap gap-2">
            {ATMOSPHERE_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={atmosphereVal.includes(opt)}
                onClick={() => toggleAtmosphere(opt)}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-gray-700">Brand Personality</p>
          <p className="mb-2 text-xs text-gray-500">Pick up to {MAX_PERSONALITY}</p>
          <div className="flex flex-wrap gap-2">
            {PERSONALITY_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={opt}
                selected={personalityVal.includes(opt)}
                disabled={!personalityVal.includes(opt) && personalityVal.length >= MAX_PERSONALITY}
                onClick={() => togglePersonality(opt)}
              />
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="bp-desc">What makes you unique?</Label>
          <textarea
            id="bp-desc"
            value={descVal}
            onChange={(e) => setDescVal(e.target.value)}
            rows={4}
            placeholder="e.g. Family-owned since 1987, known for our 72-hour slow-braised Sunday ragù."
            className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={loading} className="flex-1">
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium tracking-wide text-gray-400 uppercase">{label}</p>
      {multiline ? (
        <p className="whitespace-pre-wrap text-gray-600">{value || '—'}</p>
      ) : (
        <p className="font-semibold text-gray-800">{value || '—'}</p>
      )}
    </div>
  )
}
