'use client'

import { useState, useEffect } from 'react'
import { BrandPanel } from '@/components/BrandPanel'
import { CampaignCreator } from '@/components/CampaignCreator'
import { SideNav } from '@/components/SideNav'
import { ArchivesTab, type ArchiveEntry } from '@/components/ArchivesTab'

export type Tab = 'brand' | 'campaign' | 'archives'

interface AppShellProps {
  brand: {
    id: string
    name: string
    description: string
    brand_voice: string
  }
}

export function AppShell({ brand }: AppShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('campaign')
  const [archives, setArchives] = useState<ArchiveEntry[]>([])
  const [archivesLoading, setArchivesLoading] = useState(true)

  async function loadArchives() {
    setArchivesLoading(true)
    try {
      const res = await fetch('/api/archives')
      if (res.ok) setArchives(await res.json())
    } finally {
      setArchivesLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/archives')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setArchives(data)
        setArchivesLoading(false)
      })
      .catch(() => setArchivesLoading(false))
  }, [])

  async function handleDeleteArchive(id: string) {
    await fetch(`/api/archives/${id}`, { method: 'DELETE' })
    setArchives((prev) => prev.filter((a) => a.id !== id))
  }

  const tabHeadings: Record<Tab, string> = {
    brand: 'Brand Info',
    campaign: 'Campaign Creator',
    archives: 'Archives',
  }

  return (
    <>
      <SideNav
        brandId={brand.id}
        brandName={brand.name}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <main className="ml-48 min-h-screen bg-gray-100 p-4">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold text-gray-800">{tabHeadings[activeTab]}</h1>

          {activeTab === 'brand' && (
            <BrandPanel
              id={brand.id}
              name={brand.name}
              description={brand.description}
              brand_voice={brand.brand_voice}
            />
          )}

          {activeTab === 'campaign' && (
            <CampaignCreator brandId={brand.id} onArchiveSaved={loadArchives} />
          )}

          {activeTab === 'archives' && (
            <ArchivesTab
              archives={archives}
              loading={archivesLoading}
              onDelete={handleDeleteArchive}
            />
          )}
        </div>
      </main>
    </>
  )
}
