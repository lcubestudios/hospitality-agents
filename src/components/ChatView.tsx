'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage, generateId } from 'ai'
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { Send, Paperclip, X, AlertCircle, Download, Loader2 } from 'lucide-react'

export type ChatMode = 'quick' | 'campaign'

export interface Brand {
  name: string
  description: string
  brand_voice: string
  business_type: string
  food_drink_type: string
  location: string
  atmosphere: string[]
  personality: string[]
}

interface ChatViewProps {
  // Only name is needed client-side for display; full brand context is fetched server-side in /api/chat
  brand: Pick<Brand, 'name'>
  mode: ChatMode
  /** Pre-populate the chat with messages from a past conversation */
  initialMessages?: UIMessage[]
  /** Seed the conversation ID so new messages append to an existing conversation */
  initialConversationId?: string
}

function TypingIndicator() {
  return (
    <div style={{ animation: 'message-in 0.15s ease-out' }}>
      <div className="bg-card inline-flex rounded-2xl px-4 py-3.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="bg-muted-foreground/60 block h-1.5 w-1.5 rounded-full"
              style={{ animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generation result rendering
// ---------------------------------------------------------------------------

interface GeneratedAsset {
  url: string
  caption: string
}

interface GenerationResultPayload {
  type: 'generation_result'
  assets: GeneratedAsset[]
}

/**
 * Parse a message text for an embedded generation_result JSON block.
 * Returns { payload, prefix, suffix } if found, or null if the message
 * is plain text with no marker.
 *
 * The marker format is:
 *   {"type":"generation_result","assets":[{"url":"...","caption":"..."}]}
 *
 * It may be embedded anywhere in the message text, optionally surrounded
 * by other prose. Prefix/suffix are the text segments before/after it.
 */
function parseGenerationResult(text: string): {
  payload: GenerationResultPayload
  prefix: string
  suffix: string
} | null {
  const markerStart = text.indexOf('{"type":"generation_result"')
  if (markerStart === -1) return null

  const prefix = text.substring(0, markerStart).trim()

  // Find the matching closing brace by counting braces
  let braceCount = 0
  let markerEnd = -1
  for (let i = markerStart; i < text.length; i++) {
    if (text[i] === '{') braceCount++
    if (text[i] === '}') {
      braceCount--
      if (braceCount === 0) {
        markerEnd = i + 1
        break
      }
    }
  }

  if (markerEnd === -1) return null

  try {
    const jsonStr = text.substring(markerStart, markerEnd)
    const payload = JSON.parse(jsonStr) as GenerationResultPayload
    if (payload.type !== 'generation_result' || !Array.isArray(payload.assets)) return null

    const suffix = text.substring(markerEnd).trim()
    return { payload, prefix, suffix }
  } catch {
    return null
  }
}

function AssetCard({ asset }: { asset: GeneratedAsset }) {
  function handleDownload() {
    const a = document.createElement('a')
    a.href = asset.url
    // Derive a filename from the URL, fall back to 'asset'
    a.download = asset.url.split('/').pop()?.split('?')[0] ?? 'asset'
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={asset.url}
        alt={asset.caption}
        className="w-full object-cover"
        style={{ maxHeight: '280px' }}
      />
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <p className="text-caption text-muted-foreground flex-1 leading-relaxed">{asset.caption}</p>
        <button
          onClick={handleDownload}
          className="border-border bg-background text-caption text-foreground hover:border-primary/40 hover:text-primary flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-colors"
        >
          <Download size={12} />
          Download
        </button>
      </div>
    </div>
  )
}

function GenerationResultBlock({ text }: { text: string }) {
  const parsed = parseGenerationResult(text)
  if (!parsed) return null

  const { payload, prefix, suffix } = parsed

  return (
    <div className="space-y-3">
      {prefix && <p className="text-foreground text-sm leading-relaxed">{prefix}</p>}
      {payload.assets.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {payload.assets.map((asset, i) => (
            <AssetCard key={i} asset={asset} />
          ))}
        </div>
      )}
      {suffix && <p className="text-foreground text-sm leading-relaxed">{suffix}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Generation loading block
// ---------------------------------------------------------------------------

function GenerationLoadingBlock() {
  return (
    <div className="border-border bg-card text-muted-foreground flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm shadow-sm">
      <Loader2 size={14} className="flex-shrink-0 animate-spin" />
      <span>Generating your content — this takes around 30 seconds...</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// State for pending generation (triggered by tool call)
// ---------------------------------------------------------------------------

interface PendingGeneration {
  campaignId: string
  imageUrl?: string
  postTopic: string
  campaignMode: 'social' | 'ads'
  vibe?: string
}

interface GenerationResult {
  campaignId: string
  assets: GeneratedAsset[]
}

// Shape of what the trigger_generation tool returns
interface TriggerGenerationResult {
  campaign_id?: string | null
  params?: {
    post_topic?: string
    image_url?: string
    campaign_mode?: 'social' | 'ads'
    vibe?: string
  }
  error?: string
}

export function ChatView({ brand, mode, initialMessages, initialConversationId }: ChatViewProps) {
  const [input, setInput] = useState('')
  // stagedImage: local object URL for preview
  const [stagedImage, setStagedImage] = useState<string | null>(null)
  // stagedImageUrl: the public Supabase URL returned after upload
  const [stagedImageUrl, setStagedImageUrl] = useState<string | null>(null)
  // Upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Generation state
  const [pendingGeneration, setPendingGeneration] = useState<PendingGeneration | null>(null)
  const [generationResults, setGenerationResults] = useState<GenerationResult[]>([])
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null)

  const modeRef = useRef(mode)
  const conversationIdRef = useRef<string | null>(initialConversationId ?? null)
  const stagedImageUrlRef = useRef<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    conversationIdRef.current = conversationId
  }, [conversationId])
  useEffect(() => {
    stagedImageUrlRef.current = stagedImageUrl
  }, [stagedImageUrl])

  const transport = useMemo(() => {
    // Ref access in async callback is safe (not during render)
    // eslint-disable-next-line react-hooks/refs
    return new DefaultChatTransport({
      api: '/api/chat',
      fetch: async (url, init) => {
        const res = await fetch(url, init)
        const id = res.headers.get('X-Conversation-Id')
        if (id && !conversationIdRef.current) {
          setConversationId(id)
        }
        return res
      },
    })
  }, [])

  const { messages, sendMessage, status, error, setMessages } = useChat({
    messages: initialMessages,
    transport,
  })

  // Watch messages for tool invocations from trigger_generation
  // In AI SDK v6, tool parts have type: 'tool-{toolname}' and fields directly on the part
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue
      for (const part of msg.parts) {
        if (part.type !== 'tool-trigger_generation') continue
        const p = part as typeof part & { state: string; output?: TriggerGenerationResult }
        if (p.state !== 'output-available' || !p.output) continue
        const output = p.output
        const campaignId = output.campaign_id
        if (!campaignId) continue
        // Only trigger generation once per campaign_id
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPendingGeneration((prev) => {
          if (prev?.campaignId === campaignId) return prev
          return {
            campaignId,
            imageUrl: output.params?.image_url,
            postTopic: output.params?.post_topic ?? '',
            campaignMode: output.params?.campaign_mode ?? 'social',
            vibe: output.params?.vibe,
          }
        })
      }
    }
  }, [messages])

  // Fire generation when pendingGeneration is set
  useEffect(() => {
    if (!pendingGeneration) return
    // Already have a result for this campaign — skip
    if (generationResults.some((r) => r.campaignId === pendingGeneration.campaignId)) return

    const { campaignId, imageUrl, postTopic, campaignMode, vibe } = pendingGeneration

    async function runGeneration() {
      try {
        const res = await fetch(`/api/campaigns/${campaignId}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            post_topic: postTopic,
            campaign_mode: campaignMode,
            visual_style: vibe ? { mood: vibe } : undefined,
          }),
        })

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          console.error('Generation failed:', errData)
          // Append error as a synthetic assistant message
          setMessages((prev) => [
            ...prev,
            {
              id: generateId(),
              role: 'assistant' as const,
              parts: [
                {
                  type: 'text' as const,
                  text: 'Generation failed — please try again or check your photo and try once more.',
                },
              ],
            },
          ])
          setPendingGeneration(null)
          return
        }

        const data = (await res.json()) as {
          assets: Array<{ asset_url: string }>
          director_brief?: unknown
        }

        const assets: GeneratedAsset[] = data.assets.map((a) => ({
          url: a.asset_url,
          caption: '',
        }))

        setGenerationResults((prev) => [...prev, { campaignId, assets }])
        setPendingGeneration(null)

        // Append a synthetic assistant message carrying the generation result marker
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant' as const,
            parts: [
              {
                type: 'text' as const,
                text: JSON.stringify({ type: 'generation_result', assets }),
              },
            ],
          },
        ])
      } catch (err) {
        console.error('Generation request error:', err)
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: 'assistant' as const,
            parts: [
              {
                type: 'text' as const,
                text: 'Something went wrong during generation. Please try again.',
              },
            ],
          },
        ])
        setPendingGeneration(null)
      }
    }

    runGeneration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingGeneration])

  const isWaiting = status === 'submitted'
  const isStreaming = status === 'streaming'
  const isBusy = isWaiting || isStreaming
  const hasMessages = messages.length > 0

  // Scroll to bottom on new messages or typing
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isWaiting, pendingGeneration])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [input])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file)
    setStagedImage(localUrl)
    setStagedImageUrl(null)
    setUploadError(null)
    setIsUploading(true)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? 'Upload failed')
      }
      const { url } = (await res.json()) as { url: string }
      setStagedImageUrl(url)
    } catch (err) {
      console.error('Upload error:', err)
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      // Keep the preview but mark error
    } finally {
      setIsUploading(false)
    }
  }, [])

  function clearStagedImage() {
    if (stagedImage) URL.revokeObjectURL(stagedImage)
    setStagedImage(null)
    setStagedImageUrl(null)
    setUploadError(null)
  }

  function doSend(text: string) {
    const trimmed = text.trim()
    if (!trimmed && !stagedImage) return
    // Block send while upload is still in progress
    if (isUploading) return

    const imageUrl = stagedImageUrlRef.current

    sendMessage(
      {
        text: trimmed || '(photo attached)',
        ...(imageUrl
          ? { experimental_attachments: [{ url: imageUrl, contentType: 'image/jpeg' }] }
          : {}),
      },
      {
        body: {
          mode: modeRef.current,
          conversation_id: conversationIdRef.current ?? undefined,
          // Pass the uploaded public URL so the server can inject it into the system prompt
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      },
    )
    setInput('')
    // Clear the staged image preview
    if (stagedImage) URL.revokeObjectURL(stagedImage)
    setStagedImage(null)
    setStagedImageUrl(null)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend(input)
    }
  }

  // Send is disabled while uploading so the user waits for the URL to be ready
  const canSend = (!!input.trim() || !!stagedImage) && !isBusy && !isUploading

  const brandFirstName = brand.name.split(' ')[0]

  const emptyStateHeading = mode === 'quick' ? 'What are we promoting?' : "What's the campaign?"

  const emptyStateSubtitle =
    mode === 'quick'
      ? `Drop a photo and tell me what you're selling, ${brandFirstName}.`
      : `A new menu, upcoming event, seasonal push — whatever it is, tell me about it, ${brandFirstName}.`

  // Determine if we are actively generating (tool called but result not yet appended)
  const isGenerating = pendingGeneration !== null

  return (
    <div className="bg-background flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Pre-chat */
          <div className="flex h-full flex-col items-center justify-center px-6 pb-28">
            <div className="w-full max-w-lg space-y-3">
              <h1 className="text-display text-foreground">{emptyStateHeading}</h1>
              <p className="text-muted-foreground">{emptyStateSubtitle}</p>
            </div>
          </div>
        ) : (
          /* Chat messages */
          <div className="mx-auto w-full max-w-2xl space-y-5 px-6 py-8">
            {(messages as UIMessage[]).map((msg, i) => {
              const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant'
              const showCursor = isStreaming && isLastAssistant

              // Extract text content from text parts only
              const textContent = msg.parts
                .filter((p) => p.type === 'text')
                .map((p) => (p.type === 'text' ? p.text : ''))
                .join('')

              // If the message contains a trigger_generation tool part and no text, skip it
              const hasTriggerTool = msg.parts.some((p) => p.type === 'tool-trigger_generation')
              if (hasTriggerTool && !textContent) return null

              const attachments =
                msg.experimental_attachments || (msg as Record<string, unknown>).attachments || []

              return (
                <div
                  key={msg.id}
                  className={[
                    'flex flex-col gap-1.5',
                    msg.role === 'user' ? 'items-end' : 'items-start',
                  ].join(' ')}
                  style={{ animation: 'message-in 0.2s ease-out' }}
                >
                  {msg.role === 'user' ? (
                    <div className="flex flex-col gap-2">
                      {attachments.length > 0 && (
                        <div className="grid max-w-[80%] grid-cols-2 gap-2">
                          {attachments.map((att, i) => (
                            <div key={i} className="overflow-hidden rounded-lg">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={(att as Record<string, unknown>).url as string}
                                alt="uploaded"
                                className="h-24 w-full object-cover"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="bg-foreground text-background max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed">
                        {textContent}
                      </div>
                    </div>
                  ) : parseGenerationResult(textContent) ? (
                    <div className="w-full max-w-[85%]">
                      <GenerationResultBlock text={textContent} />
                    </div>
                  ) : textContent ? (
                    <div
                      className={`bg-card text-foreground max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${showCursor ? 'streaming-cursor' : ''}`}
                    >
                      {textContent}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {isWaiting && <TypingIndicator />}

            {/* Generation in-progress indicator */}
            {isGenerating && (
              <div
                className="flex flex-col items-start"
                style={{ animation: 'message-in 0.2s ease-out' }}
              >
                <GenerationLoadingBlock />
              </div>
            )}

            {error && (
              <div className="border-destructive/20 bg-destructive/5 text-destructive flex items-center gap-2 rounded-xl border px-4 py-3 text-sm">
                <AlertCircle size={14} className="flex-shrink-0" />
                Something went wrong. Check your connection and try again.
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-border bg-card flex-shrink-0 border-t px-6 py-4">
        <div className="mx-auto w-full max-w-2xl space-y-3">
          {/* Input box */}
          <div className="border-border bg-background focus-within:border-primary/40 focus-within:ring-primary/10 flex flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm transition-all focus-within:ring-2">
            {stagedImage && (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stagedImage} alt="Staged" className="h-20 w-20 rounded-xl object-cover" />
                {/* Upload progress overlay */}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                    <Loader2 size={16} className="animate-spin text-white" />
                  </div>
                )}
                {/* Upload error indicator */}
                {uploadError && !isUploading && (
                  <div className="bg-destructive/40 absolute inset-0 flex items-center justify-center rounded-xl">
                    <AlertCircle size={16} className="text-white" />
                  </div>
                )}
                <button
                  onClick={clearStagedImage}
                  className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full shadow"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {uploadError && (
              <p className="text-micro text-destructive">
                {uploadError} — tap X to remove and try again.
              </p>
            )}

            <div className="flex items-end gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                onClick={() => fileRef.current?.click()}
                className="text-muted-foreground hover:text-primary mb-0.5 flex h-6 w-6 flex-shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors"
                title="Attach photo"
              >
                <Paperclip size={15} />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isBusy}
                placeholder={
                  mode === 'quick'
                    ? 'What are we promoting today?'
                    : 'Describe your campaign goal...'
                }
                rows={1}
                className="text-foreground placeholder:text-muted-foreground/60 flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none disabled:opacity-50"
                style={{ maxHeight: '160px' }}
              />

              <button
                onClick={() => doSend(input)}
                disabled={!canSend}
                className="bg-primary text-primary-foreground hover:bg-primary/85 mb-0.5 flex h-7 w-7 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg transition-all disabled:opacity-25"
                title={isUploading ? 'Waiting for upload to complete...' : 'Send'}
              >
                {isUploading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>

          <p className="text-micro text-muted-foreground/50 text-center select-none">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
