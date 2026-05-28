'use client'

import { useState } from 'react'
import {
  Bookmark,
  Film,
  Heart,
  Home,
  MessageCircle,
  MoreHorizontal,
  Music,
  PlusSquare,
  Search,
  Send,
  Share2,
  ThumbsUp,
  User,
} from 'lucide-react'

interface SocialMockupsProps {
  imageUrl?: string | null
  videoUrl?: string | null
  caption?: string | null
  hashtags?: string[] | null
  brandName?: string
}

const PLATFORMS = [
  { id: 'ig-feed', label: 'IG Feed' },
  { id: 'ig-reels', label: 'IG Reels' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'fb-feed', label: 'Facebook' },
  { id: 'meta-ad', label: 'Meta Ad' },
] as const

type PlatformId = (typeof PLATFORMS)[number]['id']

function Avatar({ name }: { name: string }) {
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-semibold text-white">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function AvatarLg({ name }: { name: string }) {
  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-sm font-semibold text-white">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function MediaSlot({
  imageUrl,
  videoUrl,
  className,
}: {
  imageUrl?: string | null
  videoUrl?: string | null
  className: string
}) {
  if (videoUrl) {
    return (
      <video
        src={videoUrl}
        muted
        loop
        autoPlay
        playsInline
        className={`${className} w-full object-cover`}
      />
    )
  }
  if (imageUrl) {
    return <img src={imageUrl} alt="" className={`${className} w-full object-cover`} />
  }
  return (
    <div className={`${className} flex w-full items-center justify-center bg-gray-100`}>
      <span className="text-xs text-gray-400">No media</span>
    </div>
  )
}

function IGFeedMockup({
  imageUrl,
  videoUrl,
  handle,
  caption,
}: {
  imageUrl?: string | null
  videoUrl?: string | null
  handle: string
  caption: string
}) {
  return (
    <div className="bg-white text-[13px] text-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
        <span
          className="text-xl font-semibold"
          style={{ fontFamily: 'Georgia, serif', letterSpacing: '-0.5px' }}
        >
          Instagram
        </span>
        <div className="flex gap-4 text-gray-800">
          <Heart size={22} />
          <Send size={22} />
        </div>
      </div>
      {/* Post */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Avatar name={handle} />
          <span className="text-[13px] font-semibold">{handle}</span>
        </div>
        <MoreHorizontal size={18} className="text-gray-500" />
      </div>
      <MediaSlot imageUrl={imageUrl} videoUrl={videoUrl} className="aspect-square" />
      <div className="px-3 pt-2.5 pb-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex gap-4">
            <Heart size={22} />
            <MessageCircle size={22} />
            <Send size={22} />
          </div>
          <Bookmark size={22} />
        </div>
        <p className="mb-0.5 text-[13px] font-semibold">1,284 likes</p>
        <p className="line-clamp-3 text-[13px] leading-snug">
          <span className="mr-1 font-semibold">{handle}</span>
          {caption}
        </p>
        <p className="mt-2 text-[12px] text-gray-400">Add a comment…</p>
      </div>
      {/* Nav */}
      <div className="flex items-center justify-around border-t border-gray-100 px-6 py-3">
        <Home size={22} className="text-gray-900" />
        <Search size={22} className="text-gray-400" />
        <PlusSquare size={22} className="text-gray-400" />
        <Film size={22} className="text-gray-400" />
        <User size={22} className="text-gray-400" />
      </div>
    </div>
  )
}

function IGReelsMockup({
  imageUrl,
  videoUrl,
  handle,
  caption,
}: {
  imageUrl?: string | null
  videoUrl?: string | null
  handle: string
  caption: string
}) {
  return (
    <div className="relative overflow-hidden bg-black text-white" style={{ aspectRatio: '9/16' }}>
      {videoUrl ? (
        <video
          src={videoUrl}
          muted
          loop
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <span className="text-xs text-gray-500">No media</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
      {/* Right rail */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-0.5">
          <Heart size={26} fill="white" />
          <span className="text-[10px]">12.4k</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle size={26} />
          <span className="text-[10px]">284</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Send size={26} />
          <span className="text-[10px]">Share</span>
        </div>
        <Bookmark size={26} />
        <MoreHorizontal size={26} />
      </div>
      {/* Bottom info */}
      <div className="absolute right-14 bottom-5 left-3">
        <p className="mb-1 text-sm font-semibold">@{handle}</p>
        <p className="line-clamp-2 text-xs leading-snug text-white/90">{caption}</p>
        <div className="mt-2 flex items-center gap-1.5">
          <Music size={12} />
          <span className="text-xs text-white/70">Original audio · {handle}</span>
        </div>
      </div>
    </div>
  )
}

function TikTokMockup({
  imageUrl,
  videoUrl,
  handle,
  caption,
}: {
  imageUrl?: string | null
  videoUrl?: string | null
  handle: string
  caption: string
}) {
  return (
    <div className="relative overflow-hidden bg-black text-white" style={{ aspectRatio: '9/16' }}>
      {videoUrl ? (
        <video
          src={videoUrl}
          muted
          loop
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <span className="text-xs text-gray-500">No media</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      {/* Right rail */}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-5">
        <Avatar name={handle} />
        <div className="flex flex-col items-center gap-0.5">
          <Heart size={28} fill="white" />
          <span className="text-[10px]">12.4k</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <MessageCircle size={28} />
          <span className="text-[10px]">284</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Bookmark size={28} />
          <span className="text-[10px]">4.2k</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Share2 size={28} />
          <span className="text-[10px]">Share</span>
        </div>
      </div>
      {/* Bottom */}
      <div className="absolute right-16 bottom-5 left-3">
        <p className="mb-1 text-sm font-bold">@{handle}</p>
        <p className="line-clamp-2 text-xs leading-snug text-white/90">{caption}</p>
        <div className="mt-2 flex items-center gap-1.5 overflow-hidden">
          <Music size={12} className="flex-shrink-0" />
          <span className="truncate text-xs text-white/70">Original sound – {handle}</span>
        </div>
      </div>
    </div>
  )
}

function FBFeedMockup({
  imageUrl,
  videoUrl,
  brandName,
  caption,
  sponsored,
}: {
  imageUrl?: string | null
  videoUrl?: string | null
  brandName: string
  caption: string
  sponsored: boolean
}) {
  return (
    <div className="bg-[#f0f2f5] text-[13px] text-gray-900">
      {/* FB Header */}
      <div className="flex items-center gap-2 bg-white px-3 py-2 shadow-sm">
        <span className="text-2xl font-bold text-[#1877f2]">f</span>
        <div className="flex flex-1 items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5">
          <Search size={13} className="text-gray-400" />
          <span className="text-xs text-gray-400">Search</span>
        </div>
        <MessageCircle size={20} className="text-gray-600" />
      </div>
      {/* Post card */}
      <div className="m-2 overflow-hidden rounded-lg bg-white shadow-sm">
        <div className="flex items-start gap-2.5 px-3 py-3">
          <AvatarLg name={brandName} />
          <div className="flex-1">
            <p className="text-[13px] font-semibold">{brandName}</p>
            <p className="text-[11px] text-gray-500">
              {sponsored ? 'Sponsored · ' : 'Just now · '}🌐
            </p>
          </div>
          <MoreHorizontal size={18} className="text-gray-500" />
        </div>
        {caption && <p className="line-clamp-6 px-3 pb-2.5 text-[13px] leading-snug">{caption}</p>}
        <MediaSlot imageUrl={imageUrl} videoUrl={videoUrl} className="aspect-video" />
        {sponsored && (
          <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
            <div>
              <p className="text-[12px] font-semibold">{brandName}</p>
              <p className="text-[11px] text-gray-500">Restaurant</p>
            </div>
            <button className="rounded-md bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-gray-800">
              Learn More
            </button>
          </div>
        )}
        <div className="flex items-center justify-around border-t border-gray-100 px-2 py-1">
          {[
            { icon: <ThumbsUp size={16} />, label: 'Like' },
            { icon: <MessageCircle size={16} />, label: 'Comment' },
            { icon: <Share2 size={16} />, label: 'Share' },
          ].map(({ icon, label }) => (
            <button
              key={label}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-100"
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function SocialMockups({
  imageUrl,
  videoUrl,
  caption,
  hashtags,
  brandName = 'yourbrand',
}: SocialMockupsProps) {
  const [active, setActive] = useState<PlatformId>('ig-feed')

  const handle =
    brandName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9._]/g, '') || 'yourbrand'
  const captionText = caption ?? ''
  const tagsText = hashtags?.map((h) => `#${h.replace(/^#/, '')}`).join(' ') ?? ''
  const fullCaption = [captionText, tagsText].filter(Boolean).join('\n\n')

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            className={[
              'flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              active === p.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        {active === 'ig-feed' && (
          <IGFeedMockup
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            handle={handle}
            caption={fullCaption}
          />
        )}
        {active === 'ig-reels' && (
          <IGReelsMockup
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            handle={handle}
            caption={captionText}
          />
        )}
        {active === 'tiktok' && (
          <TikTokMockup
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            handle={handle}
            caption={captionText}
          />
        )}
        {active === 'fb-feed' && (
          <FBFeedMockup
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            brandName={brandName}
            caption={fullCaption}
            sponsored={false}
          />
        )}
        {active === 'meta-ad' && (
          <FBFeedMockup
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            brandName={brandName}
            caption={fullCaption}
            sponsored={true}
          />
        )}
      </div>
    </div>
  )
}
