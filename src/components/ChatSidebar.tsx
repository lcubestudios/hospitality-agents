'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LogOut,
  Store,
  Bell,
  Clock,
  CalendarDays,
  Zap,
  X,
  Download,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import type { View } from '@/components/AppShell'
import type { Nudge } from '@/app/api/notifications/route'
import type { RecentAsset } from '@/app/api/assets/recent/route'

// ─── API shapes ──────────────────────────────────────────────────────────────

interface ActiveCampaign {
  id: string
  post_topic: string
  status: 'Generating' | 'Completed' | 'Pending'
  created_at: string
  conversation_id?: string
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ChatSidebarProps {
  activeView: View | null
  onViewChange: (view: View | null) => void
  onSelectConversation?: (id: string, mode: 'quick' | 'campaign') => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ─── Nudge components ─────────────────────────────────────────────────────────

const NUDGE_ICONS: Record<Nudge['type'], React.ElementType> = {
  inactivity: Clock,
  deadline: CalendarDays,
  tip: Zap,
}

function NudgeCard({
  nudge,
  onSelectConversation,
}: {
  nudge: Nudge
  onSelectConversation?: (id: string, mode: 'quick' | 'campaign') => void
}) {
  const Icon = NUDGE_ICONS[nudge.type]
  const isClickable = !!nudge.conversation_id && !!onSelectConversation

  function handleClick() {
    if (!nudge.conversation_id || !onSelectConversation) return
    onSelectConversation(nudge.conversation_id, nudge.mode ?? 'campaign')
  }

  const innerContent = (
    <>
      <Icon
        size={13}
        className={nudge.read ? 'text-muted-foreground/40 mt-0.5' : 'mt-0.5 text-[#C8622A]'}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-caption text-foreground leading-snug">{nudge.message}</p>
        <span className="text-micro text-muted-foreground/50">{nudge.label}</span>
      </div>
    </>
  )

  const sharedClassName = [
    'relative flex items-start gap-3 rounded-lg bg-background px-3 py-2.5',
    !nudge.read ? 'border-l-2 border-l-[#C8622A]' : 'border-l-2 border-l-transparent',
  ].join(' ')

  if (isClickable) {
    return (
      <button
        onClick={handleClick}
        className={[
          sharedClassName,
          'hover:bg-secondary w-full cursor-pointer text-left transition-colors',
        ].join(' ')}
        style={{ animation: 'message-in 200ms ease both' }}
      >
        {innerContent}
      </button>
    )
  }

  return (
    <div className={sharedClassName} style={{ animation: 'message-in 200ms ease both' }}>
      {innerContent}
    </div>
  )
}

function NudgePanel({
  nudges,
  loading,
  onClose,
  onSelectConversation,
}: {
  nudges: Nudge[]
  loading: boolean
  onClose: () => void
  onSelectConversation?: (id: string, mode: 'quick' | 'campaign') => void
}) {
  return (
    <div className="border-border bg-card border-b">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-micro text-muted-foreground/60 tracking-widest uppercase">
          Updates
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground/50 hover:bg-secondary hover:text-foreground cursor-pointer rounded p-0.5 transition-colors"
          aria-label="Close notifications"
        >
          <X size={13} />
        </button>
      </div>

      {/* Nudge list */}
      <div className="flex flex-col gap-1 px-2 pb-3">
        {loading ? (
          <p className="text-caption text-muted-foreground/40 px-3 py-2">Loading…</p>
        ) : nudges.length === 0 ? (
          <p className="text-caption text-muted-foreground/40 px-3 py-2">All caught up.</p>
        ) : (
          nudges.map((n) => (
            <NudgeCard key={n.id} nudge={n} onSelectConversation={onSelectConversation} />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Saved Images section ────────────────────────────────────────────────────

const sectionHeaderCls =
  'flex items-center justify-between border-y border-border bg-secondary px-3 py-2 border-l-2 border-l-primary'

const THUMBNAIL_SLOTS = 3
const CAMPAIGN_SLOTS = 1

function SavedImagesSection({
  assets,
  loading,
  onDelete,
}: {
  assets: RecentAsset[]
  loading: boolean
  onDelete: (id: string) => void
}) {
  const [previewAsset, setPreviewAsset] = useState<RecentAsset | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // Close preview on outside click
  useEffect(() => {
    if (!previewAsset) return
    function handleClick(e: MouseEvent) {
      if (previewRef.current && previewRef.current.contains(e.target as Node)) return
      setPreviewAsset(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [previewAsset])

  async function handleDelete(asset: RecentAsset) {
    if (!window.confirm("Delete this image? You can't undo this.")) return
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      if (previewAsset?.id === asset.id) setPreviewAsset(null)
      onDelete(asset.id)
    } catch {
      // Silently fail — user can retry
    }
  }

  const slots = Array.from({ length: THUMBNAIL_SLOTS }, (_, i) => assets[i] ?? null)

  return (
    <div>
      <div className={sectionHeaderCls}>
        <span className="text-foreground/70 text-xs font-semibold">Saved images</span>
        <span className="text-micro text-muted-foreground/40">
          {loading ? '—' : assets.length}/{THUMBNAIL_SLOTS}
        </span>
      </div>

      <div className="py-2.5">
        {loading ? (
          <div className="flex gap-2 px-3">
            {Array.from({ length: THUMBNAIL_SLOTS }).map((_, i) => (
              <div
                key={i}
                className="bg-secondary border-border h-12 w-12 shrink-0 animate-pulse rounded-lg border border-dashed"
              />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <p className="text-caption text-muted-foreground/35 px-3 italic">
            Hit Save on any generated image to pin it here.
          </p>
        ) : (
          <div className="flex gap-2 px-3">
            {slots.map((asset, i) =>
              asset ? (
                <button
                  key={asset.id}
                  onClick={() => setPreviewAsset(previewAsset?.id === asset.id ? null : asset)}
                  className="border-border hover:border-primary/40 h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-lg border transition-all hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8622A]"
                  aria-label="Preview image"
                  style={{ animation: `message-in 200ms ease ${i * 40}ms both` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={asset.asset_url} alt="" className="h-full w-full object-cover" />
                </button>
              ) : (
                <div
                  key={`placeholder-${i}`}
                  className="bg-secondary/60 border-border/50 h-12 w-12 shrink-0 rounded-lg border border-dashed"
                />
              ),
            )}
          </div>
        )}
      </div>

      {/* Inline preview panel */}
      {previewAsset && (
        <div
          ref={previewRef}
          className="border-border bg-card mx-3 mt-1 mb-3 overflow-hidden rounded-lg border"
          style={{ animation: 'message-in 200ms ease both' }}
        >
          <div className="flex justify-end px-2 pt-2">
            <button
              onClick={() => setPreviewAsset(null)}
              className="text-muted-foreground/50 hover:bg-secondary hover:text-foreground cursor-pointer rounded p-0.5 transition-colors"
              aria-label="Close preview"
            >
              <X size={13} />
            </button>
          </div>
          <div className="px-2 pb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewAsset.asset_url}
              alt="Preview"
              className="w-full rounded-md object-cover"
            />
          </div>
          <div className="flex gap-1.5 px-2 pb-2">
            <a
              href={previewAsset.asset_url}
              download
              className="bg-primary text-caption text-primary-foreground flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 font-medium transition-opacity hover:opacity-90"
            >
              <Download size={12} />
              Download
            </a>
            <button
              onClick={() => handleDelete(previewAsset)}
              className="border-border bg-background text-caption text-destructive hover:border-destructive/40 hover:bg-destructive/5 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 font-medium transition-colors"
              aria-label="Delete image"
              title="Delete this saved image"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Active Campaigns section ─────────────────────────────────────────────────

const STATUS_STYLES: Record<ActiveCampaign['status'], string> = {
  Generating: 'text-[#C8622A] bg-primary/10',
  Completed: 'text-green-700 bg-green-50',
  Pending: 'text-muted-foreground bg-secondary',
}

const STATUS_LABELS: Record<ActiveCampaign['status'], string> = {
  Generating: 'generating',
  Completed: 'done',
  Pending: 'pending',
}

function ActiveCampaignsSection({
  campaigns,
  loading,
  onSelectConversation,
}: {
  campaigns: ActiveCampaign[]
  loading: boolean
  onSelectConversation?: (id: string, mode: 'quick' | 'campaign') => void
}) {
  return (
    <div>
      <div className={sectionHeaderCls}>
        <span className="text-foreground/70 text-xs font-semibold">Active campaigns</span>
        <span className="text-micro text-muted-foreground/40">
          {loading ? '—' : campaigns.length}/{CAMPAIGN_SLOTS}
        </span>
      </div>

      <div className="py-1.5">
        {loading ? (
          <p className="text-caption text-muted-foreground/40 px-3 py-2">Loading…</p>
        ) : campaigns.length === 0 ? (
          <p className="text-caption text-muted-foreground/35 px-3 py-2 italic">
            Start a campaign and it&apos;ll show up right here.
          </p>
        ) : (
          <ul>
            {campaigns.map((c, i) => {
              const clickable = !!c.conversation_id && !!onSelectConversation
              const inner = (
                <>
                  <div className="flex min-w-0 items-start justify-between gap-1.5">
                    <span className="text-foreground truncate text-sm leading-snug font-medium">
                      {c.post_topic}
                    </span>
                    <span
                      className={[
                        'text-micro shrink-0 rounded-md px-1.5 py-0.5 leading-none',
                        STATUS_STYLES[c.status],
                      ].join(' ')}
                    >
                      {STATUS_LABELS[c.status]}
                    </span>
                  </div>
                  <span className="text-micro text-muted-foreground/50">
                    {relativeTime(c.created_at)}
                  </span>
                </>
              )

              if (clickable) {
                return (
                  <li key={c.id}>
                    <button
                      onClick={() => onSelectConversation!(c.conversation_id!, 'campaign')}
                      className="group border-border/50 bg-background hover:border-primary/30 hover:bg-secondary mx-2 flex w-full cursor-pointer flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors"
                      style={{ animation: `message-in 200ms ease ${i * 40}ms both` }}
                    >
                      {inner}
                    </button>
                  </li>
                )
              }

              return (
                <li key={c.id}>
                  <div
                    className="border-border/50 bg-background mx-2 flex flex-col gap-1 rounded-lg border px-3 py-2.5 opacity-60"
                    style={{ animation: `message-in 200ms ease ${i * 40}ms both` }}
                  >
                    {inner}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// ─── ChatSidebar ──────────────────────────────────────────────────────────────

export function ChatSidebar({ activeView, onViewChange, onSelectConversation }: ChatSidebarProps) {
  const router = useRouter()
  const [logoutLoading, setLogoutLoading] = useState(false)

  // Recent assets (Quick Post outputs)
  const [recentAssets, setRecentAssets] = useState<RecentAsset[]>([])
  const [loadingAssets, setLoadingAssets] = useState(true)

  // Active campaigns
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)

  // Nudges
  const [nudgesOpen, setNudgesOpen] = useState(false)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [loadingNudges, setLoadingNudges] = useState(true)
  const bellRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const unreadCount = nudges.filter((n) => !n.read).length

  // Fetch recent assets
  useEffect(() => {
    fetch('/api/assets/recent')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: RecentAsset[]) => setRecentAssets(Array.isArray(data) ? data : []))
      .catch(() => setRecentAssets([]))
      .finally(() => setLoadingAssets(false))
  }, [])

  // Fetch active campaigns
  useEffect(() => {
    fetch('/api/campaigns/active')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: ActiveCampaign[]) => setActiveCampaigns(Array.isArray(data) ? data : []))
      .catch(() => setActiveCampaigns([]))
      .finally(() => setLoadingCampaigns(false))
  }, [])

  // Fetch nudges
  useEffect(() => {
    fetch('/api/notifications')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Nudge[]) => setNudges(Array.isArray(data) ? data : []))
      .catch(() => setNudges([]))
      .finally(() => setLoadingNudges(false))
  }, [])

  const closeNudges = useCallback(() => setNudgesOpen(false), [])

  // Close nudge panel on outside click
  useEffect(() => {
    if (!nudgesOpen) return
    function handleClick(e: MouseEvent) {
      if (bellRef.current && bellRef.current.contains(e.target as Node)) return
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return
      closeNudges()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [nudgesOpen, closeNudges])

  async function handleLogout() {
    setLogoutLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/auth/login')
    } catch {
      setLogoutLoading(false)
    }
  }

  const [isCollapsed, setIsCollapsed] = useState(false)

  function handleCollapse() {
    if (!isCollapsed) setNudgesOpen(false)
    setIsCollapsed((v) => !v)
  }

  const iconBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer'

  return (
    <aside
      className="border-border bg-card flex h-screen flex-shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200 ease-in-out"
      style={{ width: isCollapsed ? '56px' : '240px' }}
    >
      {/* 1. Header */}
      <div
        className={[
          'border-border flex items-center border-b px-3 py-3',
          isCollapsed ? 'justify-center' : 'justify-between',
        ].join(' ')}
      >
        {!isCollapsed && <p className="text-primary text-sm font-bold tracking-tight">AMA</p>}
        <div className={['flex items-center gap-1', isCollapsed ? 'flex-col gap-2' : ''].join(' ')}>
          {/* Bell */}
          <button
            ref={bellRef}
            onClick={() => setNudgesOpen((v) => !v)}
            className={[
              iconBtn,
              nudgesOpen
                ? 'bg-primary/8 text-primary'
                : 'text-muted-foreground/50 hover:bg-secondary hover:text-foreground',
              'relative',
            ].join(' ')}
            aria-label={nudgesOpen ? 'Close notifications' : 'Open notifications'}
            title="Notifications"
          >
            <Bell size={14} />
            {unreadCount > 0 && (
              <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] leading-none font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          {/* Collapse toggle */}
          <button
            onClick={handleCollapse}
            className={[
              iconBtn,
              'text-muted-foreground/50 hover:bg-secondary hover:text-foreground',
            ].join(' ')}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        </div>
      </div>

      {/* 2. Nudge panel */}
      {nudgesOpen && !isCollapsed && (
        <div ref={panelRef}>
          <NudgePanel
            nudges={nudges}
            loading={loadingNudges}
            onClose={closeNudges}
            onSelectConversation={onSelectConversation}
          />
        </div>
      )}

      {/* 3–5. Main content — hidden when collapsed */}
      {!isCollapsed && (
        <div className="flex flex-1 flex-col overflow-y-auto">
          {/* 4. Saved Images */}
          <SavedImagesSection
            assets={recentAssets}
            loading={loadingAssets}
            onDelete={(id) => setRecentAssets((prev) => prev.filter((a) => a.id !== id))}
          />

          {/* 5. Active Campaigns */}
          <ActiveCampaignsSection
            campaigns={activeCampaigns}
            loading={loadingCampaigns}
            onSelectConversation={onSelectConversation}
          />
        </div>
      )}

      {/* Spacer when collapsed so bottom nav stays at bottom */}
      {isCollapsed && <div className="flex-1" />}

      {/* 6. Bottom nav */}
      <div
        className={[
          'border-border space-y-0.5 border-t py-3',
          isCollapsed ? 'flex flex-col items-center px-1.5' : 'px-2',
        ].join(' ')}
      >
        <button
          onClick={() => onViewChange('brand')}
          className={[
            isCollapsed
              ? [
                  iconBtn,
                  activeView === 'brand'
                    ? 'bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                ].join(' ')
              : [
                  'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  activeView === 'brand'
                    ? 'bg-primary/8 text-primary'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                ].join(' '),
          ].join('')}
          title="Brand"
        >
          <Store size={14} />
          {!isCollapsed && <span>Brand</span>}
        </button>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          className={[
            isCollapsed
              ? [
                  iconBtn,
                  'text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50',
                ].join(' ')
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50',
          ].join('')}
          title="Log out"
        >
          <LogOut size={14} />
          {!isCollapsed && <span>{logoutLoading ? 'Logging out…' : 'Log out'}</span>}
        </button>
      </div>
    </aside>
  )
}
