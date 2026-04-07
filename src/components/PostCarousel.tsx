'use client'

import { useState, useRef } from 'react'
import { PostMedia } from '@/types'

interface PostCarouselProps {
  media: PostMedia[]
}

export default function PostCarousel({ media }: PostCarouselProps) {
  const [active, setActive] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order)

  function handleScroll() {
    if (!scrollRef.current) return
    const { scrollLeft, clientWidth } = scrollRef.current
    const idx = Math.round(scrollLeft / clientWidth)
    setActive(idx)
  }

  function scrollTo(idx: number) {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({ left: idx * scrollRef.current.clientWidth, behavior: 'smooth' })
  }

  if (sorted.length === 0) return null

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {sorted.map((item) => (
          <div key={item.id} className="snap-center flex-shrink-0 w-full">
            {item.type === 'image' && item.url && (
              <img
                src={item.url}
                alt=""
                className="w-full max-h-96 object-contain bg-gray-100"
              />
            )}
            {item.type === 'video' && item.url && (
              <video
                src={item.url}
                controls
                className="w-full max-h-96 bg-black"
              />
            )}
            {item.type === 'text' && (
              <div className="p-4 bg-gray-50 min-h-[120px] flex items-center">
                <p className="text-gray-700 text-sm whitespace-pre-wrap">{item.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {sorted.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {sorted.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                i === active ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
