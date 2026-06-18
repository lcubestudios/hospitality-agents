'use client'

import { useState } from 'react'
import { ChatView } from '@/components/ChatView'
import { HomeView } from '@/components/HomeView'
import { BrandPanel } from '@/components/BrandPanel'
import { Plus, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

export type View = 'home' | 'chat' | 'brand'
export type ChatMode = 'quick' | 'campaign'

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

const MODE_LABELS: Record<ChatMode, string> = {
  quick: 'Quick Post',
  campaign: 'Full Campaign',
}

const SAVED_ASSET_SLOTS = 5
const CAMPAIGN_SLOTS = 3

const sectionHeaderCls =
  'flex items-center justify-between border-y border-border bg-secondary px-3 py-2 border-l-2 border-l-primary'

export function AppShell({ brand }: AppShellProps) {
  const [view, setView] = useState<View>('home')
  const [chatMode, setChatMode] = useState<ChatMode>('quick')
  const [chatKey, setChatKey] = useState(0)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleSelectMode = (mode: 'quick' | 'campaign') => {
    setChatMode(mode)
    setChatKey((prev) => prev + 1)
    setView('chat')
  }

  const handleNewChat = () => {
    setChatKey((prev) => prev + 1)
    setView('chat')
  }

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={[
          'border-border bg-card flex flex-shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200',
          isCollapsed ? 'w-14' : 'w-60',
        ].join(' ')}
      >
        {/* Header */}
        <div className="border-border flex h-12 items-center border-b px-3">
          {!isCollapsed && (
            <span className="text-primary text-sm font-bold tracking-tight">AMA</span>
          )}
          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="text-muted-foreground hover:bg-secondary hover:text-foreground ml-auto flex h-8 w-8 items-center justify-center rounded-md transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        {/* New Chat */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className={[
              'bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isCollapsed ? 'w-8 justify-center p-0' : 'w-full',
            ].join(' ')}
          >
            <Plus size={15} className="flex-shrink-0" />
            {!isCollapsed && 'New Chat'}
          </button>
        </div>

        {/* Sections */}
        {!isCollapsed && (
          <div className="flex-1 overflow-y-auto">
            <div className={sectionHeaderCls}>
              <span className="text-foreground text-xs font-medium">Saved Assets</span>
              <span className="text-muted-foreground text-xs">0/{SAVED_ASSET_SLOTS}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-3">
              {Array.from({ length: SAVED_ASSET_SLOTS }).map((_, i) => (
                <div
                  key={i}
                  className="border-border/50 bg-muted/40 aspect-square rounded-md border"
                />
              ))}
            </div>

            <div className={sectionHeaderCls}>
              <span className="text-foreground text-xs font-medium">Campaigns</span>
              <span className="text-muted-foreground text-xs">0/{CAMPAIGN_SLOTS}</span>
            </div>
            <div className="space-y-1.5 p-3">
              {Array.from({ length: CAMPAIGN_SLOTS }).map((_, i) => (
                <div key={i} className="border-border/50 bg-muted/40 h-8 rounded-md border" />
              ))}
            </div>
          </div>
        )}

        {isCollapsed && <div className="flex-1" />}

        {/* Bottom Nav */}
        <div className="border-border space-y-0.5 border-t p-3">
          <button
            onClick={() => setView('brand')}
            className={[
              'flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
              isCollapsed ? 'justify-center' : '',
              view === 'brand'
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            ].join(' ')}
          >
            <Settings size={15} className="flex-shrink-0" />
            {!isCollapsed && 'Settings'}
          </button>
          <button
            className={[
              'text-muted-foreground hover:bg-secondary hover:text-foreground flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
              isCollapsed ? 'justify-center' : '',
            ].join(' ')}
          >
            <LogOut size={15} className="flex-shrink-0" />
            {!isCollapsed && 'Log out'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {view === 'home' && <HomeView brandName={brand.name} onSelectMode={handleSelectMode} />}

        {view === 'chat' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Simple header - back button + mode name */}
            <div className="border-border bg-card flex h-11 items-center gap-3 border-b px-4">
              <button
                onClick={() => setView('home')}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                ← Home
              </button>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-foreground text-sm font-medium">{MODE_LABELS[chatMode]}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatView key={chatKey} mode={chatMode} />
            </div>
          </div>
        )}

        {view === 'brand' && (
          <>
            <div className="border-border bg-card flex h-11 items-center border-b px-4">
              <button
                onClick={() => setView('home')}
                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                ← Home
              </button>
              <span className="text-muted-foreground/40 mx-2">·</span>
              <span className="text-foreground text-sm font-medium">Settings</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
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
            </div>
          </>
        )}
      </main>
    </div>
  )
}
