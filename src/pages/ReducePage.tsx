import { useState, useMemo } from 'react'
import {
  MOCK_ACTIONS,
  MOCK_HOTSPOTS,
  MOCK_FEEDBACK,
  MOCK_OBSERVATIONS,
} from '../mock/data'
import ConfidenceBadge from '../components/Confidence/ConfidenceBadge'
import { calculateConfidence } from '../services/confidence-engine'
import type { ReductionAction, ActionStatus, CampusLocation } from '../types'

const STATUS_CONFIG: Record<
  ActionStatus,
  { label: string; color: string; bg: string; icon: string; description: string }
> = {
  suggested: {
    label: 'Suggested',
    color: 'text-surface-600',
    bg: 'bg-surface-100',
    icon: '💡',
    description: 'An action idea identified from community observation patterns',
  },
  adopted: {
    label: 'Adopted',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    icon: '🤝',
    description: 'The Eco Club has accepted this idea and will implement it',
  },
  active: {
    label: 'Active',
    color: 'text-brand-600',
    bg: 'bg-brand-50',
    icon: '🟢',
    description: 'The Eco Club is currently implementing this initiative',
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    icon: '✅',
    description: 'Implementation is finished — community feedback is being collected',
  },
}

interface StudentSuggestion {
  id: string
  title: string
  explanation: string
  relatedLocation: CampusLocation | ''
  createdAt: string
  status: 'submitted'
}

// ── Internal Pattern Analysis ────────────────────────────────

interface PatternInsight {
  id: string
  location: string
  category: string
  reportCount: number
  uniqueReporters: number
  trend: 'increasing' | 'stable' | 'decreasing'
  summary: string
}

function analyzePatterns(): PatternInsight[] {
  // Group observations by location + category
  const groups: Record<string, typeof MOCK_OBSERVATIONS> = {}
  for (const obs of MOCK_OBSERVATIONS) {
    const key = `${obs.location}||${obs.plasticCategory}`
    if (!groups[key]) groups[key] = []
    groups[key].push(obs)
  }

  const insights: PatternInsight[] = []

  for (const [key, obs] of Object.entries(groups)) {
    if (obs.length < 2) continue // Need at least 2 reports for a pattern

    const [location, category] = key.split('||')
    const uniqueReporters = new Set(obs.map((o) => o.reporterId)).size
    // Determine trend based on report density
    const recentCutoff = new Date()
    recentCutoff.setDate(recentCutoff.getDate() - 3)
    const recentCount = obs.filter(
      (o) => new Date(o.date) >= recentCutoff
    ).length
    const olderCount = obs.length - recentCount

    let trend: PatternInsight['trend']
    if (recentCount > olderCount && recentCount >= 2) trend = 'increasing'
    else if (olderCount > recentCount && recentCount === 0) trend = 'decreasing'
    else trend = 'stable'

    // Generate community-friendly summary
    const categoryLabel = category.replace('-', ' ')
    const reportWord = obs.length === 1 ? 'report' : 'reports'
    const trendWord =
      trend === 'increasing'
        ? 'Community observations indicate an increase in'
        : trend === 'decreasing'
        ? 'Fewer recent reports about'
        : 'Community observations indicate a consistent pattern of'

    const summary = `${trendWord} ${categoryLabel} ${reportWord} at ${location}. ${obs.length} community ${reportWord} from ${uniqueReporters} independent ${uniqueReporters === 1 ? 'reporter' : 'reporters'}${trend === 'increasing' ? ' — consider reviewing this area for a possible reduction initiative' : ''}.`

    insights.push({
      id: `pattern-${location}-${category}`,
      location,
      category,
      reportCount: obs.length,
      uniqueReporters,
      trend,
      summary,
    })
  }

  // Sort by report count (highest first)
  return insights.sort((a, b) => b.reportCount - a.reportCount)
}

// ── Component ────────────────────────────────────────────────

export default function ReducePage() {
  const [selectedAction, setSelectedAction] = useState<ReductionAction | null>(
    null
  )
  const [filterStatus, setFilterStatus] = useState<ActionStatus | 'all'>('all')
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([])
  const [showSuggestionForm, setShowSuggestionForm] = useState(false)
  const [suggestionTitle, setSuggestionTitle] = useState('')
  const [suggestionExplanation, setSuggestionExplanation] = useState('')
  const [suggestionLocation, setSuggestionLocation] = useState<
    CampusLocation | ''
  >('')
  const [suggestionSuccess, setSuggestionSuccess] = useState(false)

  const patterns = useMemo(() => analyzePatterns(), [])

  const filteredActions =
    filterStatus === 'all'
      ? MOCK_ACTIONS
      : MOCK_ACTIONS.filter((a) => a.status === filterStatus)

  function handleSuggestionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!suggestionTitle.trim()) return

    const newSuggestion: StudentSuggestion = {
      id: `sug-${Date.now()}`,
      title: suggestionTitle.trim(),
      explanation: suggestionExplanation.trim(),
      relatedLocation: suggestionLocation,
      createdAt: new Date().toISOString(),
      status: 'submitted',
    }

    setSuggestions((prev) => [newSuggestion, ...prev])
    setSuggestionTitle('')
    setSuggestionExplanation('')
    setSuggestionLocation('')
    setShowSuggestionForm(false)
    setSuggestionSuccess(true)
    setTimeout(() => setSuggestionSuccess(false), 3000)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">Reduce</h2>
        <p className="text-sm text-surface-500 mt-1">
          Community observation patterns help the Eco Club take targeted action
        </p>
      </div>

      {/* ═══ Internal Pattern Analysis ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-surface-800">
            🧠 Community Pattern Insights
          </h3>
          <span className="text-xs bg-surface-100 text-surface-500 px-2 py-0.5 rounded-full">
            Auto-analyzed from {MOCK_OBSERVATIONS.length} observations
          </span>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 mb-4">
          ℹ These patterns are identified automatically from community-reported observations. They
          highlight areas where repeated reports suggest a potential issue — not exact measurements.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {patterns.map((pattern) => {
            // Check if there's already an action linked to this hotspot
            const hotspot = MOCK_HOTSPOTS.find(
              (h) =>
                h.location === pattern.location &&
                h.category === pattern.category
            )
            const linkedAction = hotspot
              ? MOCK_ACTIONS.find((a) => a.linkedHotspotId === hotspot.id)
              : null

            return (
              <div
                key={pattern.id}
                className="bg-white rounded-xl border border-surface-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-surface-800">
                        {pattern.location}
                      </span>
                      <span className="text-xs text-surface-400">•</span>
                      <span className="text-xs text-surface-500 capitalize">
                        {pattern.category.replace('-', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 leading-relaxed mt-1">
                      {pattern.summary}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                      pattern.trend === 'increasing'
                        ? 'text-red-600 bg-red-50'
                        : pattern.trend === 'decreasing'
                        ? 'text-emerald-600 bg-emerald-50'
                        : 'text-surface-500 bg-surface-100'
                    }`}
                  >
                    {pattern.trend === 'increasing'
                      ? '↑ Trending'
                      : pattern.trend === 'decreasing'
                      ? '↓ Improving'
                      : '→ Stable'}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-3 mt-3 text-xs text-surface-400">
                  <span>
                    {pattern.reportCount} report{pattern.reportCount !== 1 ? 's' : ''}
                  </span>
                  <span>•</span>
                  <span>
                    {pattern.uniqueReporters} independent{' '}
                    {pattern.uniqueReporters === 1 ? 'reporter' : 'reporters'}
                  </span>
                </div>

                {/* Linked action status */}
                {linkedAction && (
                  <div className="mt-3 pt-2 border-t border-surface-100">
                    <span className="text-xs text-surface-400">
                      Action:{' '}
                      <span className="text-surface-600 font-medium">
                        {STATUS_CONFIG[linkedAction.status].icon}{' '}
                        {STATUS_CONFIG[linkedAction.status].label}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══ Eco Club Actions ═══ */}
      <div className="border-t border-surface-200 pt-6">
        <h3 className="text-sm font-semibold text-surface-800 mb-3">
          Eco Club Actions
        </h3>

        {/* Status Filter */}
        <div className="flex gap-1 bg-surface-100 p-1 rounded-lg w-fit mb-4">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterStatus === 'all'
                ? 'bg-white text-surface-800 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            All ({MOCK_ACTIONS.length})
          </button>
          {(Object.keys(STATUS_CONFIG) as ActionStatus[]).map((status) => {
            const count = MOCK_ACTIONS.filter((a) => a.status === status).length
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-white text-surface-800 shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                }`}
              >
                {STATUS_CONFIG[status].icon} {STATUS_CONFIG[status].label} ({count})
              </button>
            )
          })}
        </div>

        {/* Actions List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List */}
          <div className="lg:col-span-2 space-y-3">
            {filteredActions.map((action) => {
              const hotspot = MOCK_HOTSPOTS.find(
                (h) => h.id === action.linkedHotspotId
              )
              const feedback = MOCK_FEEDBACK.filter(
                (f) => f.actionId === action.id
              )
              const confidence = calculateConfidence(feedback)
              const config = STATUS_CONFIG[action.status]

              return (
                <button
                  key={action.id}
                  onClick={() => setSelectedAction(action)}
                  className={`w-full text-left bg-white rounded-xl border p-5 transition-all hover:shadow-md ${
                    selectedAction?.id === action.id
                      ? 'border-brand-400 ring-2 ring-brand-100'
                      : 'border-surface-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${config.color} ${config.bg}`}
                        >
                          {config.icon} {config.label}
                        </span>
                        <span className="text-xs text-surface-400">
                          by {action.createdBy}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-surface-800">
                        {action.title}
                      </h3>
                      <p className="text-sm text-surface-500 mt-1 line-clamp-2">
                        {action.description}
                      </p>
                      {hotspot && (
                        <p className="text-xs text-surface-400 mt-2">
                          📍 {hotspot.location} •{' '}
                          {hotspot.category.replace('-', ' ')} •{' '}
                          {hotspot.observationCount} reports
                        </p>
                      )}
                    </div>
                    {(action.status === 'active' ||
                      action.status === 'completed') && (
                      <ConfidenceBadge
                        state={confidence.state}
                        showLabel={false}
                      />
                    )}
                  </div>
                </button>
              )
            })}

            {filteredActions.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl text-surface-300">📋</p>
                <p className="text-sm text-surface-500 mt-3">
                  No actions in this status
                </p>
              </div>
            )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1">
            {selectedAction ? (
              <ActionDetail action={selectedAction} />
            ) : (
              <div className="bg-white rounded-xl border border-surface-200 p-6 text-center">
                <p className="text-3xl text-surface-300">←</p>
                <p className="text-sm text-surface-500 mt-2">
                  Select an action to view details
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Student Suggestion Box ═══ */}
      <div className="border-t border-surface-200 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-surface-800">
              💡 Student Suggestion Box
            </h3>
            <p className="text-xs text-surface-400 mt-0.5">
              Have an idea for reducing plastic on campus? Share it with the Eco Club.
            </p>
          </div>
          <button
            onClick={() => setShowSuggestionForm(!showSuggestionForm)}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            {showSuggestionForm ? 'Cancel' : '+ New Suggestion'}
          </button>
        </div>

        {/* Success message */}
        {suggestionSuccess && (
          <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 text-sm text-brand-700 mb-4">
            ✓ Suggestion submitted! Selected ideas may earn community points
            when adopted by the Eco Club.
          </div>
        )}

        {/* Suggestion Form */}
        {showSuggestionForm && (
          <form
            onSubmit={handleSuggestionSubmit}
            className="bg-white rounded-xl border border-surface-200 p-5 space-y-4 mb-4"
          >
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Suggestion / Idea *
              </label>
              <input
                type="text"
                value={suggestionTitle}
                onChange={(e) => setSuggestionTitle(e.target.value)}
                placeholder="e.g., Add water bottle refill stations in lecture halls"
                className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Explanation{' '}
                <span className="text-surface-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={suggestionExplanation}
                onChange={(e) => setSuggestionExplanation(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder="Why would this help? Any additional context…"
                className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                Related Location{' '}
                <span className="text-surface-400 font-normal">(optional)</span>
              </label>
              <select
                value={suggestionLocation}
                onChange={(e) =>
                  setSuggestionLocation(e.target.value as CampusLocation)
                }
                className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
              >
                <option value="">Select a location…</option>
                {[
                  'Dining Hall',
                  'Student Center',
                  'Library',
                  'Gym',
                  'Lecture Halls',
                  'Dorms',
                  'Outdoor Common Areas',
                  'Café / Coffee Shop',
                  'Administrative Building',
                  'Parking Areas',
                  'Other',
                ].map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-surface-400">
              Selected ideas may earn community points when adopted by the Eco
              Club.
            </p>
            <button
              type="submit"
              disabled={!suggestionTitle.trim()}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Submit Suggestion
            </button>
          </form>
        )}

        {/* Submitted Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-3">
            {suggestions.map((sug) => (
              <div
                key={sug.id}
                className="bg-white rounded-xl border border-surface-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-surface-800">
                      💡 {sug.title}
                    </p>
                    {sug.explanation && (
                      <p className="text-xs text-surface-500 mt-1">
                        {sug.explanation}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-surface-400">
                        {new Date(sug.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      {sug.relatedLocation && (
                        <>
                          <span className="text-xs text-surface-300">•</span>
                          <span className="text-xs text-surface-400">
                            📍 {sug.relatedLocation}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="text-xs bg-surface-100 text-surface-500 px-2 py-0.5 rounded-full font-medium">
                    Submitted
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {suggestions.length === 0 && !showSuggestionForm && (
          <p className="text-xs text-surface-400 text-center py-4">
            No suggestions yet. Be the first to share an idea!
          </p>
        )}
      </div>
    </div>
  )
}

function ActionDetail({ action }: { action: ReductionAction }) {
  const hotspot = MOCK_HOTSPOTS.find((h) => h.id === action.linkedHotspotId)
  const feedback = MOCK_FEEDBACK.filter((f) => f.actionId === action.id)
  const confidence = calculateConfidence(feedback)
  const config = STATUS_CONFIG[action.status]

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5 space-y-5 sticky top-20">
      {/* Status + Title */}
      <div>
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${config.color} ${config.bg}`}
        >
          {config.icon} {config.label}
        </span>
        <p className="text-xs text-surface-400 mt-1">{config.description}</p>
        <h3 className="text-lg font-bold text-surface-800 mt-2">
          {action.title}
        </h3>
        <p className="text-sm text-surface-500 mt-1">{action.description}</p>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface-50 rounded-lg p-3">
          <p className="text-xs text-surface-400">Assigned To</p>
          <p className="text-sm font-medium text-surface-700">
            {action.assignedTo}
          </p>
        </div>
        <div className="bg-surface-50 rounded-lg p-3">
          <p className="text-xs text-surface-400">Created</p>
          <p className="text-sm font-medium text-surface-700">
            {action.createdAt}
          </p>
        </div>
        {action.startDate && (
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-surface-400">Started</p>
            <p className="text-sm font-medium text-surface-700">
              {action.startDate}
            </p>
          </div>
        )}
        {action.completedDate && (
          <div className="bg-surface-50 rounded-lg p-3">
            <p className="text-xs text-surface-400">Completed</p>
            <p className="text-sm font-medium text-surface-700">
              {action.completedDate}
            </p>
          </div>
        )}
      </div>

      {/* Linked Hotspot */}
      {hotspot && (
        <div className="border-t border-surface-100 pt-4">
          <p className="text-xs font-medium text-surface-500 mb-1">
            Linked Pattern
          </p>
          <p className="text-sm text-surface-700">
            {hotspot.location} — {hotspot.category.replace('-', ' ')}
          </p>
          <p className="text-xs text-surface-400">
            {hotspot.observationCount} community reports
          </p>
        </div>
      )}

      {/* Community Confidence */}
      {(action.status === 'active' || action.status === 'completed') && (
        <div className="border-t border-surface-100 pt-4">
          <p className="text-xs font-medium text-surface-500 mb-2">
            Community Confidence
          </p>
          <div className="flex items-center gap-3">
            <ConfidenceBadge state={confidence.state} />
            <span className="text-sm font-bold text-surface-800">
              {confidence.score}/100
            </span>
          </div>
          <div className="mt-2">
            <div className="w-full bg-surface-100 rounded-full h-2">
              <div
                className="bg-brand-500 h-2 rounded-full transition-all"
                style={{ width: `${confidence.score}%` }}
              />
            </div>
          </div>
          <div className="mt-3 space-y-1">
            <p className="text-xs text-surface-400">
              {confidence.independentContributors} independent contributors
            </p>
            <p className="text-xs text-surface-400">
              {confidence.totalFeedback} total feedback over{' '}
              {confidence.timeSpanDays} days
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      {action.notes.length > 0 && (
        <div className="border-t border-surface-100 pt-4">
          <p className="text-xs font-medium text-surface-500 mb-2">Notes</p>
          <div className="space-y-1.5">
            {action.notes.map((note, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                <p className="text-xs text-surface-600">{note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
