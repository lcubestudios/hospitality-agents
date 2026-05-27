'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { View } from '@/components/AppShell'

interface SideNavProps {
  activeView: View
  onViewChange: (view: View) => void
}

const NAV_ITEMS: { view: View; label: string }[] = [
  { view: 'home', label: 'Agents' },
  { view: 'brand', label: 'Settings' },
]

export function SideNav({ activeView, onViewChange }: SideNavProps) {
  const router = useRouter()
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

  return (
    <nav className="fixed top-0 left-0 flex h-screen w-48 flex-col border-r border-gray-200 bg-gray-50 p-4">
      {/* View nav items */}
      <div className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ view, label }) => (
          <button
            key={view}
            onClick={() => onViewChange(view)}
            className={[
              'flex w-full items-center rounded px-3 py-2 text-sm font-medium transition-colors',
              activeView === view
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Log Out at bottom */}
      <div className="border-t border-gray-200 pt-4">
        <Button
          onClick={handleLogout}
          disabled={logoutLoading}
          variant="outline"
          className="w-full justify-start"
          title="Log Out"
        >
          {logoutLoading ? 'Logging out...' : 'Log Out'}
        </Button>
      </div>
    </nav>
  )
}
