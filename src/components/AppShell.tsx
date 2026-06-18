'use client'

import { useState } from 'react'
import { BrandPanel } from '@/components/BrandPanel'
import { CampaignCreator } from '@/components/CampaignCreator'
import { SideNav } from '@/components/SideNav'
import { AgentGrid } from '@/components/AgentGrid'
import { Button } from '@/components/ui/button'
import { ChevronLeft } from 'lucide-react'

export type View = 'home' | 'campaign-creator' | 'brand'

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
  const [activeView, setActiveView] = useState<View>('home')

  function handleSelectAgent(agentId: string) {
    if (agentId === 'campaign-creator') {
      setActiveView('campaign-creator')
    }
  }

  return (
    <>
      <SideNav activeView={activeView} onViewChange={setActiveView} />
      <main className="ml-48 min-h-screen bg-gray-100 p-4">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Back button for non-home views */}
          {activeView !== 'home' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView('home')}
              className="gap-2"
            >
              <ChevronLeft size={18} />
              Back to agents
            </Button>
          )}

          {/* Home view */}
          {activeView === 'home' && <AgentGrid onSelectAgent={handleSelectAgent} />}

          {/* Campaign Creator view */}
          {activeView === 'campaign-creator' && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-1 text-2xl font-bold text-gray-900">Campaign Creator</h2>
                <p className="text-sm text-gray-500">
                  Upload a photo, pick a style, and get a campaign-ready image, caption, and video —
                  tailored to your brand.
                </p>
              </div>
              <CampaignCreator brandId={brand.id} />
            </div>
          )}

          {/* Settings view */}
          {activeView === 'brand' && (
            <BrandPanel
              id={brand.id}
              name={brand.name}
              description={brand.description}
              business_type={brand.business_type}
              food_drink_type={brand.food_drink_type}
              location={brand.location}
              atmosphere={brand.atmosphere}
              personality={brand.personality}
            />
          )}
        </div>
      </main>
    </>
  )
}
