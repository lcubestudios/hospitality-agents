'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface BrandPanelProps {
  id: string
  name: string
  description: string
}

export function BrandPanel({ id, name, description }: BrandPanelProps) {
  const [editing, setEditing] = useState(false)
  const [nameVal, setNameVal] = useState(name)
  const [descVal, setDescVal] = useState(description)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError('')
    setSaved(false)

    try {
      const res = await fetch(`/api/brands/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameVal, description: descVal }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.message || 'Failed to save')
      }

      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setNameVal(name)
    setDescVal(description)
    setEditing(false)
    setError('')
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Brand</h2>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>

      {editing ? (
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outline" onClick={handleCancel} disabled={loading} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="font-medium">{nameVal}</p>
          <p className="text-sm text-gray-500">{descVal || 'No description yet.'}</p>
          {saved && <p className="text-sm text-green-600">Saved!</p>}
        </div>
      )}
    </Card>
  )
}
