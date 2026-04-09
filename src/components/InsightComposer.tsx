'use client'

import { useState } from 'react'
import type { Insight } from '@/types'

interface InsightComposerProps {
  onPublish: (insight: Insight) => void
}

export default function InsightComposer({ onPublish }: InsightComposerProps) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const trimmed = body.trim()
  const charCount = trimmed.length
  const isValid = charCount > 0 && charCount <= 1000

  async function handleSubmit() {
    if (!isValid || submitting) return
    setSubmitting(true)

    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: trimmed }),
    })

    if (res.ok) {
      const insight = await res.json()
      onPublish(insight)
      setBody('')
    }

    setSubmitting(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Share a trading insight..."
        rows={3}
        className="w-full resize-none text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none leading-relaxed"
      />
      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${charCount > 1000 ? 'text-red-500' : charCount > 900 ? 'text-amber-500' : 'text-gray-400'}`}>
          {charCount}/1000
        </span>
        <button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  )
}
