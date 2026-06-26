'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Loader2 } from 'lucide-react'
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

interface BrandEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  brand: Brand
  onSave: () => void
}

export function BrandEditModal({ open, onOpenChange, brand, onSave }: BrandEditModalProps) {
  const router = useRouter()
  const [name, setName] = useState(brand.name)
  const [description, setDescription] = useState(brand.description)
  const [businessType, setBusinessType] = useState(brand.business_type)
  const [foodDrinkType, setFoodDrinkType] = useState(brand.food_drink_type)
  const [location, setLocation] = useState(brand.location)
  const [atmosphere, setAtmosphere] = useState(brand.atmosphere)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/brands/${brand.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          business_type: businessType,
          food_drink_type: foodDrinkType,
          location,
          atmosphere,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save')
      }

      router.refresh()
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName(brand.name)
    setDescription(brand.description)
    setBusinessType(brand.business_type)
    setFoodDrinkType(brand.food_drink_type)
    setLocation(brand.location)
    setAtmosphere(brand.atmosphere)
    setError('')
    onOpenChange(false)
  }

  const toggleAtmosphere = (val: string) => {
    setAtmosphere((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-lg bg-white">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Edit Brand Details</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 px-6 py-6">
          {/* Name */}
          <div>
            <Label htmlFor="name">Brand Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 flex min-h-24 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Tell us about your brand..."
            />
          </div>

          {/* Business Type */}
          <div>
            <Label htmlFor="business-type">Type of Business</Label>
            <select
              id="business-type"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              disabled={loading}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a business type</option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Food/Drink Type */}
          <div>
            <Label htmlFor="food-drink-type">Food & Drink Type</Label>
            <select
              id="food-drink-type"
              value={foodDrinkType}
              onChange={(e) => setFoodDrinkType(e.target.value)}
              disabled={loading}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a food/drink type</option>
              {FOOD_DRINK_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={loading}
              placeholder="e.g., Downtown, Brooklyn, Manhattan"
              className="mt-1"
            />
          </div>

          {/* Atmosphere */}
          <div>
            <Label>Atmosphere</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {ATMOSPHERE_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => toggleAtmosphere(option)}
                  disabled={loading}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                    atmosphere.includes(option)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  } disabled:opacity-50`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-3 border-t border-gray-200 bg-white px-6 py-4">
          <Button variant="outline" onClick={handleClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  )
}
