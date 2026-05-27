'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [nameVal, setNameVal] = useState(name)
  const [descVal, setDescVal] = useState(description)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setLoading(true)
    setError('')

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

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">Brand Info</h2>
            <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
              Edit
            </Button>
          </div>
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-gray-400 uppercase">
                Brand Name
              </p>
              <p className="font-semibold text-gray-800">{nameVal}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-gray-400 uppercase">
                Description
              </p>
              <p className="text-gray-600">{descVal || '—'}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-xl font-bold">Account</h2>
          <Button
            onClick={() => setShowDeleteConfirm(true)}
            variant="outline"
            disabled={deleting}
            className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
            title="Delete Account"
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
                  {deleting ? 'Deleting...' : 'Delete'}
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

  return (
    <Card className="p-6">
      <h2 className="mb-4 text-xl font-bold">Edit Brand Info</h2>
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
    </Card>
  )
}
