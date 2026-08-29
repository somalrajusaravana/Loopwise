import { useState, useEffect } from 'react'
import { fetchObservations } from '../../services/api'
import type { Observation } from '../../types'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    straws: '🥤',
    'cups-lids': '☕',
    utensils: '🍴',
    bottles: '🧴',
    'food-packaging': '📦',
    bags: '🛍️',
    containers: '🥡',
    other: '♻️',
  }
  return icons[category] ?? '♻️'
}

interface Props {
  newObservations?: Observation[]
}

export default function TrackHistory({ newObservations = [] }: Props) {
  const [observations, setObservations] = useState<Observation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const data = await fetchObservations()
      // Merge: new submissions first, then fetched data, deduplicated by id
      const all = [...newObservations, ...data]
      const unique = all.filter(
        (obs, i, arr) => arr.findIndex((o) => o.id === obs.id) === i
      )
      setObservations(unique)
      setLoading(false)
    }
    load()
  }, [newObservations])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-surface-200 p-4 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-200" />
              <div className="flex-1">
                <div className="h-4 bg-surface-200 rounded w-32" />
                <div className="h-3 bg-surface-200 rounded w-48 mt-2" />
                <div className="h-3 bg-surface-200 rounded w-24 mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (observations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl text-surface-300">📋</p>
        <p className="text-sm text-surface-500 mt-3">No observations yet</p>
        <p className="text-xs text-surface-400 mt-1">
          Be the first to report a plastic observation!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {observations.map((obs: Observation) => (
        <div
          key={obs.id}
          className="bg-white rounded-xl border border-surface-200 p-4 flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-lg shrink-0">
            {getCategoryIcon(obs.plasticCategory)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-surface-800">
                {obs.plasticCategory.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
              <span className="text-xs text-surface-400">•</span>
              <span className="text-xs text-surface-500">{obs.location}</span>
            </div>
            {obs.description && (
              <p className="text-sm text-surface-600 mt-1 line-clamp-2">
                {obs.description}
              </p>
            )}
            {typeof obs.aiConfidence === 'number' && (
              <p className="text-xs text-purple-500 mt-1">
                🤖 AI Confidence: {Math.round(obs.aiConfidence * 100)}%
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-surface-400">
              <span>{obs.reporterName}</span>
              <span>{formatDate(obs.date)}</span>
              <span className="text-brand-500 font-medium">+{obs.pointsAwarded} pts</span>
            </div>
          </div>
          {obs.flaggedForReview && (
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-1 rounded-full font-medium shrink-0 border border-amber-200">
              ⚠ Under Review
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
