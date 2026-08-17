'use client'

import { GenerateForm } from '@/components/GenerateForm'
import { BrandCard } from '@/components/BrandCard'
import { LogOut } from 'lucide-react'

interface AppShellProps {
  brand: {
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
}

export function AppShell({ brand }: AppShellProps) {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/auth/login'
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-border bg-card flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">DOTS</h1>
        <button
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
        >
          <LogOut size={16} />
          Log out
        </button>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-auto bg-gray-50">
        <div className="mx-auto w-full max-w-2xl space-y-8 px-6 py-8">
          {/* Brand Details Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Brand Details</h2>
            <BrandCard brand={brand} />
          </section>

          {/* Generate Section */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Generate Asset</h2>
            <GenerateForm brand={brand} />
          </section>
        </div>
      </main>
    </div>
  )
}
