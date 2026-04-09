'use client'

import { Lightbulb } from 'lucide-react'
import InsightFeed from '@/components/InsightFeed'

export default function InsightsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Lightbulb size={22} />
        Insights
      </h1>
      <InsightFeed />
    </div>
  )
}
