import { useState, useEffect } from 'react'
import type { ReductionAction, ActionStatus } from '../types'
import ConfidenceBadge from '../components/Confidence/ConfidenceBadge'
import { calculateConfidence } from '../services/confidence-engine'
import { useUser } from '../contexts/UserContext'
import {
  computeHotspots,
  fetchActions,
  fetchFeedback,
  fetchSuggestions,
  createSuggestion,
  createAction,
  adoptSuggestion,
  dismissSuggestion,
  updateActionStatus,
  type ComputedHotspot,
  type StudentSuggestion,
} from '../services/api'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'suggested', label: '💡 Suggested' },
  { key: 'adopted', label: '🤝 Adopted' },
  { key: 'active', label: '🟢 Active' },
  { key: 'completed', label: '✅ Completed' },
] as const

type StatusTab = (typeof STATUS_TABS)[number]['key']

function getActionForHotspot(
  actions: ReductionAction[],
  location: string,
  category: string
): ReductionAction | undefined {
  return actions.find(
    (a) =>
      a.linkedHotspotLocation === location &&
      a.linkedHotspotCategory === category
  )
}

// Valid forward-only lifecycle transitions
const VALID_TRANSITIONS: Record<string, { next: string; label: string; confirm: string }[]> = {
  suggested: [
    { next: 'adopted', label: '🤝 Adopt', confirm: 'Adopt this action? The Eco Club will take ownership.' },
  ],
  adopted: [
    { next: 'active', label: '🟢 Start', confirm: 'Mark this action as actively being implemented?' },
  ],
  active: [
    { next: 'completed', label: '✅ Complete', confirm: 'Mark this action as completed?' },
  ],
}

export default function ReducePage() {
  const { role } = useUser()
  const [patterns, setPatterns] = useState<ComputedHotspot[]>([])
  const [actions, setActions] = useState<ReductionAction[]>([])
  const [allFeedback, setAllFeedback] = useState<ReturnType<typeof calculateConfidence>[]>([])
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([])
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [expandedAction, setExpandedAction] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Action lifecycle state
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Suggestion form state
  const [sugTitle, setSugTitle] = useState('')
  const [sugExplanation, setSugExplanation] = useState('')
  const [sugLocation, setSugLocation] = useState('')
  const [sugSuccess, setSugSuccess] = useState(false)

  // Create Action from Suggestion state
  const [creatingFromSuggestion, setCreatingFromSuggestion] = useState<string | null>(null)
  const [actionTitle, setActionTitle] = useState('')
  const [actionDescription, setActionDescription] = useState('')
  const [actionLocation, setActionLocation] = useState('')
  const [creatingLoading, setCreatingLoading] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [hotspots, acts, feedback, sugs] = await Promise.all([
        computeHotspots(),
        fetchActions(),
        fetchFeedback(),
        fetchSuggestions(),
      ])
      setPatterns(hotspots)
      setActions(acts)
      setAllFeedback(
        acts.map((a) =>
          calculateConfidence(feedback.filter((f) => f.actionId === a.id))
        )
      )
      setSuggestions(sugs)
      setLoading(false)
    }
    load()
  }, [])

  async function handleStatusChange(actionId: string, newStatus: string) {
    const action = actions.find((a) => a.id === actionId)
    if (!action) return

    const transition = VALID_TRANSITIONS[action.status]?.find(
      (t) => t.next === newStatus
    )
    if (!transition) return

    if (!window.confirm(transition.confirm)) return

    setUpdatingActionId(actionId)
    setStatusError(null)

    try {
      const success = await updateActionStatus(
        actionId,
        newStatus as 'adopted' | 'active' | 'completed'
      )

      if (success) {
        // Update local state immediately
        setActions((prev) =>
          prev.map((a) => {
            if (a.id !== actionId) return a
            const today = new Date().toISOString().split('T')[0]
            return {
              ...a,
              status: newStatus as ActionStatus,
              startDate:
                newStatus === 'active' ? today : a.startDate,
              completedDate:
                newStatus === 'completed' ? today : a.completedDate,
            }
          })
        )
      } else {
        setStatusError('Failed to update status. Please try again.')
      }
    } catch {
      setStatusError('An error occurred while updating status.')
    } finally {
      setUpdatingActionId(null)
    }
  }

  const filteredActions =
    activeTab === 'all'
      ? actions
      : actions.filter((a) => a.status === activeTab)

  async function handleSuggestionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sugTitle.trim()) return

    await createSuggestion({
      title: sugTitle.trim(),
      explanation: sugExplanation.trim() || undefined,
      relatedLocation: sugLocation || undefined,
    })

    setSugTitle('')
    setSugExplanation('')
    setSugLocation('')
    setSugSuccess(true)

    // Refresh suggestions
    const updated = await fetchSuggestions()
    setSuggestions(updated)

    setTimeout(() => setSugSuccess(false), 3000)
  }

  function openCreateActionForm(sug: StudentSuggestion) {
    setCreatingFromSuggestion(sug.id)
    setActionTitle(sug.title)
    setActionDescription(sug.explanation ?? '')
    setActionLocation(sug.relatedLocation ?? '')
  }

  function cancelCreateAction() {
    setCreatingFromSuggestion(null)
    setActionTitle('')
    setActionDescription('')
    setActionLocation('')
  }

  async function handleCreateActionFromSuggestion(sugId: string) {
    if (!actionTitle.trim()) return

    setCreatingLoading(true)
    try {
      const newAction = await createAction({
        title: actionTitle.trim(),
        description: actionDescription.trim() || undefined,
        linkedHotspotLocation: actionLocation || undefined,
        sourceSuggestionId: sugId,
      })

      if (newAction) {
        // Mark suggestion as adopted
        await adoptSuggestion(sugId)

        // Refresh both lists
        const [updatedActions, updatedSuggestions] = await Promise.all([
          fetchActions(),
          fetchSuggestions(),
        ])
        setActions(updatedActions)
        setSuggestions(updatedSuggestions)

        // Reset form
        cancelCreateAction()
      }
    } finally {
      setCreatingLoading(false)
    }
  }

  async function handleDismissSuggestion(sugId: string) {
    if (!window.confirm('Dismiss this suggestion? It will be marked as dismissed.')) return

    await dismissSuggestion(sugId)
    const updated = await fetchSuggestions()
    setSuggestions(updated)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-surface-800">Reduce</h2>
          <p className="text-sm text-surface-500 mt-1">Loading...</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-48" />
              <div className="h-3 bg-surface-200 rounded w-64 mt-2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">Reduce</h2>
        <p className="text-sm text-surface-500 mt-1">
          Eco Club workspace — review community patterns and manage reduction actions
        </p>
      </div>

      {/* ── Community Pattern Insights ───────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-surface-800 mb-2">
          🧠 Community Pattern Insights
        </h3>
        <p className="text-xs text-surface-400 mb-4">
          Auto-analyzed from community observations — these are patterns, not exact measurements.
        </p>

        {patterns.length === 0 ? (
          <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
            <p className="text-3xl text-surface-300">🔍</p>
            <p className="text-sm text-surface-500 mt-3">No patterns identified yet</p>
            <p className="text-xs text-surface-400 mt-1">
              Patterns emerge as more community observations are submitted
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patterns.map((pattern) => {
              const linkedAction = getActionForHotspot(
                actions,
                pattern.location,
                pattern.category
              )

              return (
                <div
                  key={`${pattern.location}-${pattern.category}`}
                  className="bg-white rounded-xl border border-surface-200 p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-surface-800">
                        📍 {pattern.location}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {pattern.category.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        pattern.trend === 'increasing'
                          ? 'text-amber-600 bg-amber-50 border border-amber-200'
                          : pattern.trend === 'stable'
                          ? 'text-surface-600 bg-surface-100 border border-surface-200'
                          : 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                      }`}
                    >
                      {pattern.trend === 'increasing'
                        ? '↑ Trending'
                        : pattern.trend === 'stable'
                        ? '→ Stable'
                        : '↓ Decreasing'}
                    </span>
                  </div>

                  <p className="text-xs text-surface-500 mt-3 leading-relaxed">
                    Community observations indicate{' '}
                    {pattern.observationCount} reports of{' '}
                    {pattern.category.replace('-', ' ')} at {pattern.location}.
                    {pattern.trend === 'increasing'
                      ? ' Reports are increasing recently.'
                      : pattern.trend === 'decreasing'
                      ? ' Reports have decreased recently.'
                      : ' Reports have been consistent.'}{' '}
                    Consider reviewing this area for a possible reduction initiative.
                  </p>

                  <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
                    <span>
                      {pattern.observationCount} reports from{' '}
                      {pattern.uniqueReporters} reporters
                    </span>
                    <span>
                      {pattern.firstReported} – {pattern.lastReported}
                    </span>
                  </div>

                  {linkedAction && (
                    <div className="mt-3 pt-3 border-t border-surface-100">
                      <span className="text-xs text-surface-500">
                        Linked action:{' '}
                        <span className="font-medium text-surface-700">
                          {linkedAction.title}
                        </span>
                        <span className="ml-1">
                          (
                          {linkedAction.status === 'active'
                            ? '🟢 Active'
                            : linkedAction.status === 'adopted'
                            ? '🤝 Adopted'
                            : linkedAction.status === 'completed'
                            ? '✅ Completed'
                            : '💡 Suggested'}
                          )
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Eco Club Actions ────────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-surface-800 mb-2">
          Eco Club Actions
        </h3>

        {/* Action lifecycle explanation */}
        <div className="bg-surface-50 rounded-lg p-3 mb-4 text-xs text-surface-500 flex flex-wrap gap-x-6 gap-y-1">
          <span>💡 Suggested — action idea identified from community data</span>
          <span>🤝 Adopted — Eco Club has accepted the idea</span>
          <span>🟢 Active — implementation underway</span>
          <span>✅ Completed — initiative is in place</span>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const count =
              tab.key === 'all'
                ? actions.length
                : actions.filter((a) => a.status === tab.key).length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-brand-600 text-white'
                    : 'bg-white text-surface-600 border border-surface-200 hover:bg-surface-50'
                }`}
              >
                {tab.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Actions list */}
        <div className="space-y-3">
          {filteredActions.length === 0 ? (
            <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
              <p className="text-3xl text-surface-300">📋</p>
              <p className="text-sm text-surface-500 mt-3">
                No actions in this category
              </p>
            </div>
          ) : (
            filteredActions.map((action) => {
              const feedback = allFeedback.find(
                (_, i) => actions[i]?.id === action.id
              )
              const isExpanded = expandedAction === action.id
              const hasConfidence =
                action.status === 'active' || action.status === 'completed'

              return (
                <div
                  key={action.id}
                  className="bg-white rounded-xl border border-surface-200"
                >
                  <button
                    onClick={() =>
                      setExpandedAction(isExpanded ? null : action.id)
                    }
                    className="w-full text-left p-5"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              action.status === 'active'
                                ? 'text-brand-600 bg-brand-50 border border-brand-200'
                                : action.status === 'completed'
                                ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                                : action.status === 'adopted'
                                ? 'text-blue-600 bg-blue-50 border border-blue-200'
                                : 'text-surface-600 bg-surface-100 border border-surface-200'
                            }`}
                          >
                            {action.status.charAt(0).toUpperCase() + action.status.slice(1)}
                          </span>
                          <span className="text-xs text-surface-400">
                            by {action.createdBy}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-surface-800 mt-2">
                          {action.title}
                        </p>
                        <p className="text-xs text-surface-500 mt-1 line-clamp-2">
                          {action.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        {hasConfidence && feedback && (
                          <ConfidenceBadge state={feedback.state} />
                        )}
                        <span
                          className={`text-surface-400 transition-transform ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        >
                          ▾
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-surface-100 pt-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-surface-400">Assigned to</span>
                          <p className="text-surface-700 font-medium mt-0.5">
                            {action.assignedTo}
                          </p>
                        </div>
                        <div>
                          <span className="text-surface-400">Created</span>
                          <p className="text-surface-700 font-medium mt-0.5">
                            {new Date(action.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        {action.startDate && (
                          <div>
                            <span className="text-surface-400">Started</span>
                            <p className="text-surface-700 font-medium mt-0.5">
                              {action.startDate}
                            </p>
                          </div>
                        )}
                        {action.completedDate && (
                          <div>
                            <span className="text-surface-400">Completed</span>
                            <p className="text-surface-700 font-medium mt-0.5">
                              {action.completedDate}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Community Confidence */}
                      {hasConfidence && feedback && (
                        <div className="bg-surface-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-surface-500">
                              Community Confidence
                            </span>
                            <div className="flex items-center gap-2">
                              <ConfidenceBadge state={feedback.state} />
                              <span className="text-sm font-bold text-surface-800">
                                {feedback.score}/100
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-surface-200 rounded-full h-2 mb-2">
                            <div
                              className="bg-brand-500 h-2 rounded-full transition-all"
                              style={{ width: `${feedback.score}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-xs text-surface-400">
                            <span>
                              {feedback.independentContributors} independent
                              contributors
                            </span>
                            <span>
                              {feedback.totalFeedback} total feedback over{' '}
                              {feedback.timeSpanDays} day
                              {feedback.timeSpanDays !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {action.notes.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-surface-500">
                            Notes
                          </span>
                          <ul className="mt-1 space-y-1">
                            {action.notes.map((note, i) => (
                              <li
                                key={i}
                                className="text-xs text-surface-600 bg-surface-50 rounded-lg px-3 py-2"
                              >
                                {note}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* ── Lifecycle Controls (Eco Club only) ── */}
                      {role === 'eco-club' && (
                        <div className="border-t border-surface-100 pt-4">
                          <span className="text-xs font-medium text-surface-500 block mb-2">
                            Manage Action
                          </span>
                          {statusError && (
                            <p className="text-xs text-red-500 mb-2">
                              {statusError}
                            </p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {VALID_TRANSITIONS[action.status]?.map((t) => (
                              <button
                                key={t.next}
                                onClick={() => handleStatusChange(action.id, t.next)}
                                disabled={updatingActionId === action.id}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                  t.next === 'adopted'
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : t.next === 'active'
                                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {updatingActionId === action.id
                                  ? 'Updating…'
                                  : t.label}
                              </button>
                            ))}
                            {(!VALID_TRANSITIONS[action.status] || VALID_TRANSITIONS[action.status].length === 0) && (
                              <span className="text-xs text-surface-400 italic">
                                Action is completed — no further changes
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Student Suggestions ──────────────────────────── */}
      <div>
        <h3 className="text-lg font-semibold text-surface-800 mb-2">
          💡 Student Suggestions
        </h3>
        <p className="text-xs text-surface-400 mb-4">
          Ideas submitted by students for the Eco Club to review
        </p>

        {/* Suggestion form */}
        <div className="bg-white rounded-xl border border-surface-200 p-5 mb-4">
          {sugSuccess ? (
            <p className="text-xs text-brand-600 font-medium">
              ✓ Suggestion submitted! The Eco Club will review it.
            </p>
          ) : (
            <form onSubmit={handleSuggestionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">
                  Suggestion / Idea *
                </label>
                <input
                  type="text"
                  value={sugTitle}
                  onChange={(e) => setSugTitle(e.target.value)}
                  placeholder="e.g., Replace plastic cutlery with bamboo alternatives"
                  className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">
                  Explanation <span className="text-surface-400">(optional)</span>
                </label>
                <textarea
                  value={sugExplanation}
                  onChange={(e) => setSugExplanation(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="Why this would help..."
                  className="w-full border border-surface-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 mb-1">
                  Related Location <span className="text-surface-400">(optional)</span>
                </label>
                <select
                  value={sugLocation}
                  onChange={(e) => setSugLocation(e.target.value)}
                  className="w-full border border-surface-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                >
                  <option value="">Select a location…</option>
                  {[
                    'Dining Hall',
                    'Student Center',
                    'Library',
                    'Gym',
                    'Lecture Halls',
                    'Dorms',
                    'Café / Coffee Shop',
                  ].map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-surface-400">
                  Selected ideas may earn community points when adopted by the Eco Club.
                </p>
                <button
                  type="submit"
                  disabled={!sugTitle.trim()}
                  className="px-4 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Suggestion
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Existing suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            {suggestions.map((sug) => (
              <div
                key={sug.id}
                className="bg-white rounded-xl border border-surface-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-surface-800">
                        {sug.title}
                      </p>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          sug.status === 'adopted'
                            ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                            : sug.status === 'dismissed'
                            ? 'text-red-600 bg-red-50 border border-red-200'
                            : 'text-surface-600 bg-surface-100 border border-surface-200'
                        }`}
                      >
                        {sug.status.charAt(0).toUpperCase() + sug.status.slice(1)}
                      </span>
                    </div>
                    {sug.explanation && (
                      <p className="text-xs text-surface-500 mt-1">
                        {sug.explanation}
                      </p>
                    )}
                    {sug.relatedLocation && (
                      <p className="text-xs text-surface-400 mt-1">
                        📍 {sug.relatedLocation}
                      </p>
                    )}
                  </div>
                </div>

                {/* Eco Club action buttons for pending suggestions */}
                {role === 'eco-club' && sug.status === 'pending' && creatingFromSuggestion !== sug.id && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-surface-100">
                    <button
                      onClick={() => openCreateActionForm(sug)}
                      className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      🚀 Create Action
                    </button>
                    <button
                      onClick={() => handleDismissSuggestion(sug.id)}
                      className="px-3 py-1.5 text-xs font-medium text-surface-500 hover:text-red-600 border border-surface-200 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Inline Create Action form */}
                {role === 'eco-club' && creatingFromSuggestion === sug.id && (
                  <div className="mt-3 pt-3 border-t border-surface-100 space-y-3">
                    <p className="text-xs font-medium text-surface-500">
                      Create Reduction Action from this suggestion
                    </p>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Action Title *
                      </label>
                      <input
                        type="text"
                        value={actionTitle}
                        onChange={(e) => setActionTitle(e.target.value)}
                        className="w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Description <span className="text-surface-400">(optional)</span>
                      </label>
                      <textarea
                        value={actionDescription}
                        onChange={(e) => setActionDescription(e.target.value)}
                        rows={2}
                        className="w-full border border-surface-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-surface-600 mb-1">
                        Related Location <span className="text-surface-400">(optional)</span>
                      </label>
                      <select
                        value={actionLocation}
                        onChange={(e) => setActionLocation(e.target.value)}
                        className="w-full border border-surface-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      >
                        <option value="">Select a location…</option>
                        {[
                          'Dining Hall', 'Student Center', 'Library', 'Gym',
                          'Lecture Halls', 'Dorms', 'Café / Coffee Shop',
                        ].map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCreateActionFromSuggestion(sug.id)}
                        disabled={!actionTitle.trim() || creatingLoading}
                        className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {creatingLoading ? 'Creating…' : '✓ Confirm & Create Action'}
                      </button>
                      <button
                        onClick={cancelCreateAction}
                        disabled={creatingLoading}
                        className="px-3 py-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
