'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { Tab } from '@/components/AppShell'

interface SideNavProps {
  brandId: string
  brandName: string
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const NAV_ITEMS: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'brand', label: 'Brand Info', icon: '◈' },
  { tab: 'campaign', label: 'Campaign', icon: '⊕' },
  { tab: 'archives', label: 'Archives', icon: '▤' },
]

export function SideNav({ brandId, brandName, activeTab, onTabChange }: SideNavProps) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(true)
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
      const res = await fetch(`/api/brands/${brandId}`, { method: 'DELETE' })
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
    <nav
      className={`fixed top-0 left-0 flex h-screen flex-col border-r border-gray-200 bg-gray-50 transition-all duration-300 ${
        isCollapsed ? 'w-16 p-2' : 'w-56 p-4'
      }`}
    >
      {/* Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="mb-4 flex h-8 w-8 items-center justify-center rounded hover:bg-gray-200"
        title={isCollapsed ? 'Expand' : 'Collapse'}
      >
        <span className="text-lg">{isCollapsed ? '→' : '←'}</span>
      </button>

      {/* Tab nav items */}
      <div className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ tab, label, icon }) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            title={isCollapsed ? label : undefined}
            className={[
              'flex w-full items-center rounded px-2 py-2 text-sm transition-colors',
              isCollapsed ? 'justify-center' : 'gap-3',
              activeTab === tab
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
            ].join(' ')}
          >
            <span className="text-base leading-none">{icon}</span>
            {!isCollapsed && <span className="font-medium">{label}</span>}
          </button>
        ))}
      </div>

      {/* Account actions */}
      <div className={`space-y-2 border-t border-gray-200 pt-4 ${isCollapsed ? 'space-y-1' : ''}`}>
        <Button
          onClick={() => setShowDeleteConfirm(true)}
          variant="outline"
          disabled={deleting}
          size={isCollapsed ? 'sm' : 'default'}
          className={`${
            isCollapsed ? 'h-8 w-8 p-0' : 'w-full justify-start'
          } text-red-600 hover:bg-red-50 hover:text-red-700`}
          title="Delete Account"
        >
          {isCollapsed ? '×' : 'Delete Account'}
        </Button>

        {!isCollapsed && showDeleteConfirm && (
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
          size={isCollapsed ? 'sm' : 'default'}
          className={isCollapsed ? 'h-8 w-8 p-0' : 'w-full justify-start'}
          title="Log Out"
        >
          {isCollapsed ? '⊙' : logoutLoading ? 'Logging out...' : 'Log Out'}
        </Button>
      </div>
    </nav>
  )
}
