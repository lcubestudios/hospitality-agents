'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface SideNavProps {
  brandId: string
  brandName: string
}

export function SideNav({ brandId, brandName }: SideNavProps) {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [logoutLoading, setLogoutLoading] = useState(false)

  async function handleLogout() {
    setLogoutLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/auth/login')
    } catch (err) {
      console.error('Logout failed:', err)
      setLogoutLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/brands/${brandId}`, {
        method: 'DELETE',
      })

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

  return (
    <nav className="fixed top-0 left-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-gray-50 p-4">
      <div className="flex-1">
        <h2 className="text-sm font-semibold text-gray-600 uppercase">Account</h2>
      </div>

      <div className="space-y-2 border-t border-gray-200 pt-4">
        <Button
          onClick={() => setShowDeleteConfirm(true)}
          variant="outline"
          disabled={deleting}
          className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          Delete Account
        </Button>

        {showDeleteConfirm && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-xs font-medium text-red-900">
              Delete &quot;{brandName}&quot;? Cannot undo.
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

        <Button
          onClick={handleLogout}
          disabled={logoutLoading}
          variant="outline"
          className="w-full justify-start"
        >
          {logoutLoading ? 'Logging out...' : 'Log Out'}
        </Button>
      </div>
    </nav>
  )
}
