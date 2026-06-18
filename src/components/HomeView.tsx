'use client'

import { Zap, BookOpen } from 'lucide-react'

interface HomeViewProps {
  brandName: string
  onSelectMode: (mode: 'quick' | 'campaign') => void
}

export function HomeView({ brandName, onSelectMode }: HomeViewProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      {/* Greeting */}
      <div className="mb-16 text-center">
        <h1 className="mb-2 text-5xl font-bold text-gray-900">
          Hello, <span className="text-[#C8622A]">{brandName}</span>
        </h1>
        <p className="text-lg text-gray-600">What would you like to create today?</p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid w-full max-w-2xl grid-cols-2 gap-8">
        {/* Quick Post */}
        <button
          onClick={() => onSelectMode('quick')}
          className="group relative rounded-2xl border-2 border-transparent bg-white p-8 transition-all hover:border-[#C8622A] hover:shadow-lg"
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-[#F7F5F2] p-4 transition-colors group-hover:bg-[#C8622A]/10">
              <Zap size={40} className="text-[#C8622A]" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Quick Post</h2>
            <p className="text-gray-600">
              Upload a photo and get enhanced images, captions, and hashtags instantly
            </p>
          </div>
        </button>

        {/* Full Campaign */}
        <button
          onClick={() => onSelectMode('campaign')}
          className="group relative rounded-2xl border-2 border-transparent bg-white p-8 transition-all hover:border-[#C8622A] hover:shadow-lg"
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-[#F7F5F2] p-4 transition-colors group-hover:bg-[#C8622A]/10">
              <BookOpen size={40} className="text-[#C8622A]" />
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Full Campaign</h2>
            <p className="text-gray-600">
              Plan a complete campaign with a schedule, multiple variations, and strategy
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
