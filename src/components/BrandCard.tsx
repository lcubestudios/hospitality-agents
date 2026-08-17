'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { BUSINESS_TYPES, FOOD_DRINK_OPTIONS, ATMOSPHERE_OPTIONS } from '@/data/brand-options'

interface Brand {
  id: string
  name: string
  description: string
  brand_voice: string
  business_type: string
  food_drink_type: string
  location: string
  atmosphere: string[]
  personality: string[]
}

interface BrandCardProps {
  brand: Brand
}

const FIELD_CLASS =
  'border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export function BrandCard({ brand }: BrandCardProps) {
  const router = useRouter()

  // Displayed values. Updated on save so the card reflects edits immediately,
  // while router.refresh() re-syncs the server copy in the background.
  const [data, setData] = useState(brand)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(brand)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const startEdit = () => {
    setForm(data)
    setError('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setForm(data)
    setError('')
    setEditing(false)
  }

  const toggleAtmosphere = (val: string) => {
    setForm((prev) => ({
      ...prev,
      atmosphere: prev.atmosphere.includes(val)
        ? prev.atmosphere.filter((v) => v !== val)
        : [...prev.atmosphere, val],
    }))
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/brands/${brand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          business_type: form.business_type,
          food_drink_type: form.food_drink_type,
          location: form.location,
          atmosphere: form.atmosphere,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save')
      }

      setData(form)
      setEditing(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header: name + description. In edit mode the fields run the full card
            width and the actions move to the footer, next to the last field. */}
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="brand-name">Brand Name</Label>
              <Input
                id="brand-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={loading}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="brand-description">Description</Label>
              <textarea
                id="brand-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                disabled={loading}
                placeholder="Tell us about your brand..."
                className={`${FIELD_CLASS} flex min-h-32`}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900">{data.name}</h3>
              {data.description && <p className="mt-1 text-sm text-gray-600">{data.description}</p>}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={startEdit}
              className="shrink-0 cursor-pointer"
            >
              Edit
            </Button>
          </div>
        )}

        {/* Detail grid */}
        <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
          {editing ? (
            <>
              <div>
                <Label htmlFor="business-type" className="text-xs font-medium text-gray-500">
                  Business Type
                </Label>
                <select
                  id="business-type"
                  value={form.business_type}
                  onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                  disabled={loading}
                  className={FIELD_CLASS}
                >
                  <option value="">Select a business type</option>
                  {BUSINESS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="food-drink-type" className="text-xs font-medium text-gray-500">
                  Food/Drink Type
                </Label>
                <select
                  id="food-drink-type"
                  value={form.food_drink_type}
                  onChange={(e) => setForm({ ...form, food_drink_type: e.target.value })}
                  disabled={loading}
                  className={FIELD_CLASS}
                >
                  <option value="">Select a food/drink type</option>
                  {FOOD_DRINK_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="location" className="text-xs font-medium text-gray-500">
                  Location
                </Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  disabled={loading}
                  placeholder="e.g., Downtown, Brooklyn, Manhattan"
                  className="mt-1"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs font-medium text-gray-500">Atmosphere</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {ATMOSPHERE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleAtmosphere(option)}
                      disabled={loading}
                      className={`cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                        form.atmosphere.includes(option)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      } disabled:cursor-default disabled:opacity-50`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
                  {error}
                </div>
              )}
            </>
          ) : (
            <>
              {data.business_type && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Business Type</p>
                  <p className="text-sm text-gray-900">{data.business_type}</p>
                </div>
              )}
              {data.food_drink_type && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Food/Drink Type</p>
                  <p className="text-sm text-gray-900">{data.food_drink_type}</p>
                </div>
              )}
              {data.location && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Location</p>
                  <p className="text-sm text-gray-900">{data.location}</p>
                </div>
              )}
              {data.atmosphere.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500">Atmosphere</p>
                  <p className="text-sm text-gray-900">{data.atmosphere.join(', ')}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions — sit next to the last field being edited */}
        {editing && (
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={cancelEdit}
              disabled={loading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading} className="cursor-pointer">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
