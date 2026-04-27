'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'

interface BrandFormData {
  name: string
  description: string
}

export function BrandProfileForm() {
  const [data, setData] = useState<BrandFormData>({ name: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const res = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save brand')
      }

      setSuccess(true)
      setData({ name: '', description: '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-md p-6">
      <h2 className="mb-4 text-xl font-bold">Brand Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Brand Name</Label>
          <Input
            id="name"
            placeholder="e.g., Luna Cafe"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            placeholder="What makes your brand unique?"
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
          />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Saving...' : 'Save Brand'}
        </Button>
        {success && <p className="text-sm text-green-600">Brand saved!</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Card>
  )
}
