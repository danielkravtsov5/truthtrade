'use client'

import { useState } from 'react'
import Feed from '@/components/Feed'
import FeedFilters from '@/components/FeedFilters'

export default function FilteredFeed({ type, userId }: { type: 'following' | 'explore'; userId?: string }) {
  const [filters, setFilters] = useState<Record<string, string>>({})

  return (
    <>
      <FeedFilters filters={filters} onChange={setFilters} />
      <Feed type={type} userId={userId} filters={filters} />
    </>
  )
}
