import { useState, useEffect } from 'react'
import type { Observation, ReductionAction } from '../types'
import ConfidenceBadge from './Confidence/ConfidenceBadge'
import { calculateConfidence } from '../services/confidence-engine'
import { useUser } from '../contexts/UserContext'
import {
  fetchDashboardStats,
  fetchActions,
  fetchFeedback,
  createSuggestion,
  type DashboardStats,
} from '../services/api'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function StatCard({
  label,
  value,
  sublabel,
  color = 'brand',
}: {
  label: string
  value: number | string
  sublabel?: string
  color?: string
}) {
  const bgMap: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
  }
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5">
      <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-3xl font-bold mt-1 ${bgMap[color]?.split(' ')[1] ?? 'text-surface-800'}`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-surface-400 mt-1">{sublabel}</p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { role } = useUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [actionsWithFeedback, setActionsWithFeedback] = useState<
    { action: ReductionAction; confidence: ReturnType<typeof calculateConfidence> }[]
  >([])
  const [suggestionTitle, setSuggestionTitle] = useState('')
  const [suggestionSuccess, setSuggestionSuccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [dashboardStats, actions, feedback] = await Promise.all([
        fetchDashboardStats(),
        fetchActions(),
        fetchFeedback(),
      ])

      setStats(dashboardStats)

      const actionsWithConfidence = actions
        .filter((a) => a.status === 'active' || a.status === 'completed')
        .map((action) => ({
          action,
          confidence: calculateConfidence(
            feedback.filter((f) => f.actionId === action.id)
          ),
        }))

      setActionsWithFeedback(actionsWithConfidence)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSuggestionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!suggestionTitle.trim()) return

    await createSuggestion({ title: suggestionTitle.trim() })
    setSuggestionTitle('')
    setSuggestionSuccess(true)
    setTimeout(() => setSuggestionSuccess(false), 3000)
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-surface-800">Dashboard</h2>
          <p className="text-sm text-surface-500 mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
              <div className="h-3 bg-surface-200 rounded w-20" />
              <div className="h-8 bg-surface-200 rounded w-12 mt-2" />
              <div className="h-3 bg-surface-200 rounded w-24 mt-2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">Dashboard</h2>
        <p className="text-sm text-surface-500 mt-1">
          {role === 'student'
            ? 'Your campus sustainability overview'
            : 'Eco Club operations overview'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Observations"
          value={stats.totalObservations}
          sublabel="Community-reported"
          color="brand"
        />
        <StatCard
          label="Active Hotspots"
          value={stats.activeHotspots}
          sublabel="Recurring patterns"
          color="amber"
        />
        <StatCard
          label="Active Actions"
          value={stats.activeActions}
          sublabel="In progress"
          color="blue"
        />
        <StatCard
          label="Verified Actions"
          value={stats.communityVerifiedActions}
          sublabel="Community confirmed"
          color="emerald"
        />
      </div>

      {/* Confidence Overview */}
      {actionsWithFeedback.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-surface-800 mb-4">
            Community Confidence
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actionsWithFeedback.map(({ action, confidence }) => (
              <div
                key={action.id}
                className="bg-white rounded-xl border border-surface-200 p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">
                      {action.title}
                    </p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {action.status} • {confidence.independentContributors} contributors
                    </p>
                  </div>
                  <ConfidenceBadge state={confidence.state} />
                </div>
                <div className="mt-3">
                  <div className="w-full bg-surface-100 rounded-full h-2">
                    <div
                      className="bg-brand-500 h-2 rounded-full transition-all"
                      style={{ width: `${confidence.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-surface-400 mt-1 text-right">
                    {confidence.score}/100
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student Suggestion Quick Submit */}
      {role === 'student' && (
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h3 className="text-sm font-semibold text-surface-800 mb-1">
            💡 Have a reduction idea?
          </h3>
          <p className="text-xs text-surface-400 mb-3">
            Share it with the Eco Club. Selected ideas may earn community points
            when adopted.
          </p>
          {suggestionSuccess ? (
            <p className="text-xs text-brand-600 font-medium">
              ✓ Suggestion submitted! The Eco Club will review it.
            </p>
          ) : (
            <form onSubmit={handleSuggestionSubmit} className="flex gap-2">
              <input
                type="text"
                value={suggestionTitle}
                onChange={(e) => setSuggestionTitle(e.target.value)}
                placeholder="e.g., Add water bottle refill stations in lecture halls"
                className="flex-1 border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              />
              <button
                type="submit"
                disabled={!suggestionTitle.trim()}
                className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit
              </button>
            </form>
          )}
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className="text-lg font-semibold text-surface-800 mb-4">
          Recent Observations
        </h3>
        <div className="bg-white rounded-xl border border-surface-200 divide-y divide-surface-100">
          {stats.recentActivity.map((obs: Observation) => (
            <div key={obs.id} className="px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-lg shrink-0">
                {getCategoryIcon(obs.plasticCategory)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">
                  {obs.description || `${obs.plasticCategory.replace('-', ' ')} observation`}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">
                  {obs.location} • {obs.reporterName} • {formatDate(obs.date)}
                </p>
              </div>
              {obs.flaggedForReview && (
                <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                  Under Review
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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
