'use client'

import { useState } from 'react'
import { CheckCircle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { Card } from '@/components/ui/card'

export interface ArchiveEntry {
  id: string
  name: string
  description: string | null
  image_url: string | null
  video_url: string | null
  caption: string | null
  hashtags: string[] | null
  created_at: string
}

interface ArchivesTabProps {
  archives: ArchiveEntry[]
  loading: boolean
  onDelete: (id: string) => void
}

export function ArchivesTab({ archives, loading, onDelete }: ArchivesTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedOutputs, setExpandedOutputs] = useState<Record<string, Set<string>>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  function toggleOutput(archiveId: string, key: string) {
    setExpandedOutputs((prev) => {
      const current = new Set(prev[archiveId] ?? [])
      if (current.has(key)) {
        current.delete(key)
      } else {
        current.add(key)
      }
      return { ...prev, [archiveId]: current }
    })
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    setConfirmDeleteId(null)
    await onDelete(id)
    setDeleting(null)
    if (expandedId === id) setExpandedId(null)
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-400">Loading archives...</p>
      </Card>
    )
  }

  if (archives.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-400">
          No archives yet. Generate a campaign and save it to see it here.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {archives.map((archive) => {
        const isOpen = expandedId === archive.id
        const outputs = expandedOutputs[archive.id] ?? new Set()
        const date = new Date(archive.created_at)
        const dateStr = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })

        const outputTypes = [
          archive.image_url && 'Image',
          archive.caption && 'Caption',
          archive.video_url && 'Video',
        ]
          .filter(Boolean)
          .join(' · ')

        return (
          <Card key={archive.id} className="overflow-hidden p-0">
            {/* Archive header row */}
            <button
              onClick={() => setExpandedId(isOpen ? null : archive.id)}
              className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-gray-50"
            >
              {archive.image_url && (
                <img
                  src={archive.image_url}
                  alt={archive.name}
                  className="h-14 w-14 flex-shrink-0 rounded-lg border object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{archive.name}</p>
                {archive.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{archive.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  {outputTypes} · {dateStr} at {timeStr}
                </p>
              </div>
              <span className="mt-1 flex-shrink-0">
                {isOpen ? (
                  <ChevronUp size={16} className="text-gray-400" />
                ) : (
                  <ChevronDown size={16} className="text-gray-400" />
                )}
              </span>
            </button>

            {/* Expanded content — accordion sections per output */}
            {isOpen && (
              <div className="border-t border-gray-100">
                {archive.image_url && (
                  <div>
                    <button
                      onClick={() => toggleOutput(archive.id, 'image')}
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
                    >
                      <CheckCircle size={14} className="flex-shrink-0 text-green-500" />
                      <span className="flex-1 font-medium text-gray-700">Generated Image</span>
                      {outputs.has('image') ? (
                        <ChevronUp size={14} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={14} className="text-gray-400" />
                      )}
                    </button>
                    {outputs.has('image') && (
                      <div className="border-b border-gray-100 bg-gray-50 p-4">
                        <img
                          src={archive.image_url}
                          alt="Generated"
                          className="w-full rounded-lg border object-cover"
                        />
                        <a
                          href={archive.image_url}
                          download="archived-image.jpg"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 block text-center text-xs text-blue-600 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {archive.caption && (
                  <div>
                    <button
                      onClick={() => toggleOutput(archive.id, 'caption')}
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
                    >
                      <CheckCircle size={14} className="flex-shrink-0 text-green-500" />
                      <span className="flex-1 font-medium text-gray-700">Generated Caption</span>
                      {outputs.has('caption') ? (
                        <ChevronUp size={14} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={14} className="text-gray-400" />
                      )}
                    </button>
                    {outputs.has('caption') && (
                      <div className="border-b border-gray-100 bg-gray-50 p-4">
                        <p className="text-sm leading-relaxed text-gray-800">{archive.caption}</p>
                        {archive.hashtags && archive.hashtags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {archive.hashtags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                              >
                                #{tag.replace(/^#/, '')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {archive.video_url && (
                  <div>
                    <button
                      onClick={() => toggleOutput(archive.id, 'video')}
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left text-sm transition-colors hover:bg-gray-50"
                    >
                      <CheckCircle size={14} className="flex-shrink-0 text-green-500" />
                      <span className="flex-1 font-medium text-gray-700">Generated Video</span>
                      {outputs.has('video') ? (
                        <ChevronUp size={14} className="text-gray-400" />
                      ) : (
                        <ChevronDown size={14} className="text-gray-400" />
                      )}
                    </button>
                    {outputs.has('video') && (
                      <div className="bg-gray-50 p-4">
                        <video
                          src={archive.video_url}
                          controls
                          className="w-full rounded-lg border"
                        />
                        <a
                          href={archive.video_url}
                          download="archived-video.mp4"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 block text-center text-xs text-blue-600 hover:underline"
                        >
                          Download
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Delete */}
                <div className="flex items-center justify-end gap-2 px-4 py-3">
                  {confirmDeleteId === archive.id ? (
                    <>
                      <span className="text-xs text-gray-500">Delete this archive?</span>
                      <button
                        onClick={() => handleDelete(archive.id)}
                        disabled={deleting === archive.id}
                        className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                      >
                        {deleting === archive.id ? 'Deleting...' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(archive.id)}
                      className="flex items-center gap-1.5 text-xs text-red-400 transition-colors hover:text-red-600"
                    >
                      <X size={12} />
                      Delete archive
                    </button>
                  )}
                </div>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
