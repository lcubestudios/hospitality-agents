'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

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
  onEdit: () => void
}

export function BrandCard({ brand, onEdit }: BrandCardProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900">{brand.name}</h3>
            {brand.description && <p className="mt-1 text-sm text-gray-600">{brand.description}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          {brand.business_type && (
            <div>
              <p className="text-xs font-medium text-gray-500">Business Type</p>
              <p className="text-sm text-gray-900">{brand.business_type}</p>
            </div>
          )}
          {brand.food_drink_type && (
            <div>
              <p className="text-xs font-medium text-gray-500">Food/Drink Type</p>
              <p className="text-sm text-gray-900">{brand.food_drink_type}</p>
            </div>
          )}
          {brand.location && (
            <div>
              <p className="text-xs font-medium text-gray-500">Location</p>
              <p className="text-sm text-gray-900">{brand.location}</p>
            </div>
          )}
          {brand.atmosphere.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500">Atmosphere</p>
              <p className="text-sm text-gray-900">{brand.atmosphere.join(', ')}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
