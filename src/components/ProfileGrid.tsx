'use client'

import { Post } from '@/types'
import TradeCard from './TradeCard'

interface ProfileGridProps {
  posts: Post[]
}

export default function ProfileGrid({ posts }: ProfileGridProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No trades yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {posts.map(post => (
        <TradeCard key={post.id} post={post} compact />
      ))}
    </div>
  )
}
