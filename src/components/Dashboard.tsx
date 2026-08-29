import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Observation, ReductionAction, ActionFeedback, StreakInfo } from '../types'
import ConfidenceBadge from './Confidence/ConfidenceBadge'
import { calculateConfidence } from '../services/confidence-engine'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchObservations,
  fetchActions,
  fetchFeedback,
  fetchSuggestions,
  createSuggestion,
  type StudentSuggestion,
} from '../services/api'
import {
  getUserPoints,
  getStreakInfo,
  recordNothingToReportCheckin,
  checkAndAwardStreakBonus,
} from '../services/points-engine'

// ── Helpers ──────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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
    surface: 'bg-surface-100 text-surface-600',
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

// ── Student Dashboard ────────────────────────────────────

function StudentDashboard({
  observations,
  feedback,
  loading,
}: {
  observations: Observation[]
  feedback: ActionFeedback[]
  loading: boolean
}) {
  const { appUser } = useAuth()
  const userName = appUser?.name ?? 'Student'
  const userId = appUser?.id ?? ''
  const [suggestionTitle, setSuggestionTitle] = useState('')
  const [suggestionSuccess, setSuggestionSuccess] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null)
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [checkinMessage, setCheckinMessage] = useState<string | null>(null)

  const myObservations = observations.filter((o) => o.reporterId === userId)
  const myFeedback = feedback.filter((f) => f.reporterId === userId)

  // Load real points and streak from the engine
  useEffect(() => {
    if (!userId) return
    async function loadStudentData() {
      await checkAndAwardStreakBonus(userId)
      const [points, streak] = await Promise.all([
        getUserPoints(userId),
        getStreakInfo(userId),
      ])
      setTotalPoints(points)
      setStreakInfo(streak)
    }
    loadStudentData()
  }, [userId])

  async function handleSuggestionSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!suggestionTitle.trim()) return
    await createSuggestion({ title: suggestionTitle.trim(), userId })
    setSuggestionTitle('')
    setSuggestionSuccess(true)
    setTimeout(() => setSuggestionSuccess(false), 3000)
  }

  async function handleNothingToReport() {
    setCheckinLoading(true)
    setCheckinMessage(null)
    try {
      const result = await recordNothingToReportCheckin(userId)
      if (result.alreadyCheckedIn) {
        setCheckinMessage('Already checked in today!')
      } else if (result.success) {
        setCheckinMessage(`Checked in! +${result.pointsAwarded} points`)
        const [points, streak] = await Promise.all([
          getUserPoints(userId),
          getStreakInfo(userId),
        ])
        setTotalPoints(points)
        setStreakInfo(streak)
        await checkAndAwardStreakBonus(userId)
        const updatedPoints = await getUserPoints(userId)
        setTotalPoints(updatedPoints)
      }
    } finally {
      setCheckinLoading(false)
      setTimeout(() => setCheckinMessage(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-surface-800">Dashboard</h2>
          <p className="text-sm text-surface-500 mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">
          Welcome back, {userName}
        </h2>
        <p className="text-sm text-surface-500 mt-1">
          Your campus sustainability participation
        </p>
      </div>

      {/* Personal Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Points"
          value={totalPoints}
          sublabel="Earned through participation"
          color="emerald"
        />
        <StatCard
          label="Weekly Streak"
          value={streakInfo ? `${streakInfo.currentStreak}/7` : '—/7'
          }
          sublabel={streakInfo?.todayCheckedIn ? 'Checked in today' : `${streakInfo?.daysUntilBonus ?? 7} days to bonus`}
          color="amber"
        />
        <StatCard
          label="My Contributions"
          value={myObservations.length + myFeedback.length}
          sublabel={`${myObservations.length} observations, ${myFeedback.length} feedback`}
          color="brand"
        />
      </div>

      {/* Daily Check-in */}
      <div className="bg-white rounded-xl border border-surface-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-surface-800">
              📋 Daily Participation
            </h3>
            <p className="text-xs text-surface-400 mt-0.5">
              {streakInfo?.todayCheckedIn
                ? 'You already participated today — nice work!'
                : 'Check in even if you have nothing to report today'}
            </p>
          </div>
          {!streakInfo?.todayCheckedIn && (
            <button
              onClick={handleNothingToReport}
              disabled={checkinLoading}
              className="px-4 py-2 bg-surface-100 text-surface-700 text-sm font-medium rounded-lg hover:bg-surface-200 disabled:opacity-50 transition-colors"
            >
              {checkinLoading ? 'Checking in…' : 'I didn\'t buy/upload anything today'}
            </button>
          )}
        </div>
        {checkinMessage && (
          <p className="text-xs text-brand-600 font-medium mt-2">✓ {checkinMessage}</p>
        )}
        {/* Streak progress bar */}
        {streakInfo && streakInfo.currentStreak > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-100 rounded-full h-2">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all"
                  style={{ width: `${(streakInfo.currentStreak / 7) * 100}%` }}
                />
              </div>
              <span className="text-xs text-surface-500 font-medium">
                {streakInfo.currentStreak}/7 days
              </span>
            </div>
            {streakInfo.currentStreak >= 7 && (
              <p className="text-xs text-amber-600 font-medium mt-1">
                🎉 Weekly streak complete! +15 bonus points awarded.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Quick Suggestion */}
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

      {/* My Recent Observations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-surface-800">
            My Recent Observations
          </h3>
          {myObservations.length > 0 && (
            <span className="text-xs text-surface-400">
              {myObservations.length} total
            </span>
          )}
        </div>
        {myObservations.length === 0 ? (
          <div className="bg-white rounded-xl border border-surface-200 p-8 text-center">
            <p className="text-3xl text-surface-300">📸</p>
            <p className="text-sm text-surface-500 mt-3">No observations yet</p>
            <p className="text-xs text-surface-400 mt-1">
              Head to Track to report your first plastic observation
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-surface-200 divide-y divide-surface-100">
            {myObservations.slice(0, 5).map((obs) => (
              <div key={obs.id} className="px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-lg shrink-0">
                  {getCategoryIcon(obs.plasticCategory)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">
                    {obs.description || `${obs.plasticCategory.replace('-', ' ')} observation`}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {obs.location} • {formatDate(obs.date)}
                  </p>
                </div>
                <span className="text-xs text-emerald-600 font-medium shrink-0">
                  +{obs.pointsAwarded} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Eco Club Dashboard ───────────────────────────────────

function EcoClubDashboard({
  observations,
  actions,
  feedback,
  suggestions,
  loading,
}: {
  observations: Observation[]
  actions: ReductionAction[]
  feedback: ActionFeedback[]
  suggestions: StudentSuggestion[]
  loading: boolean
}) {
  const navigate = useNavigate()

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending')
  const activeActions = actions.filter((a) => a.status === 'active')
  const completedActions = actions.filter((a) => a.status === 'completed')
  const recentObservations = observations.slice(0, 5)

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">Eco Club Dashboard</h2>
        <p className="text-sm text-surface-500 mt-1">
          Operations overview — review community data and manage actions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Community Observations"
          value={observations.length}
          sublabel="Total submitted"
          color="brand"
        />
        <StatCard
          label="Pending Suggestions"
          value={pendingSuggestions.length}
          sublabel="Awaiting review"
          color="amber"
        />
        <StatCard
          label="Active Actions"
          value={activeActions.length}
          sublabel="Currently in progress"
          color="blue"
        />
        <StatCard
          label="Completed"
          value={completedActions.length}
          sublabel="Initiatives delivered"
          color="emerald"
        />
      </div>

      {/* Pending Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-800">
              💡 Pending Suggestions
            </h3>
            <button
              onClick={() => navigate('/reduce')}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              View all →
            </button>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 divide-y divide-surface-100">
            {pendingSuggestions.slice(0, 3).map((sug) => (
              <div key={sug.id} className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800">
                      {sug.title}
                    </p>
                    {sug.explanation && (
                      <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">
                        {sug.explanation}
                      </p>
                    )}
                    {sug.relatedLocation && (
                      <p className="text-xs text-surface-400 mt-0.5">
                        📍 {sug.relatedLocation}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-amber-600 bg-amber-50 border border-amber-200 shrink-0 ml-3">
                    Pending
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Actions */}
      {activeActions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-surface-800">
              🟢 Active Actions
            </h3>
            <button
              onClick={() => navigate('/reduce')}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium"
            >
              Manage →
            </button>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 divide-y divide-surface-100">
            {activeActions.map((action) => {
              const actionFeedback = feedback.filter((f) => f.actionId === action.id)
              const confidence = calculateConfidence(actionFeedback)
              return (
                <div key={action.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">
                      {action.title}
                    </p>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {action.linkedHotspotLocation || 'Campus'} • Started {action.startDate || 'recently'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ConfidenceBadge state={confidence.state} />
                    <span className="text-xs text-surface-400 w-8 text-right">
                      {confidence.score}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Community Observations */}
      <div>
        <h3 className="text-lg font-semibold text-surface-800 mb-4">
          📋 Recent Community Observations
        </h3>
        <div className="bg-white rounded-xl border border-surface-200 divide-y divide-surface-100">
          {recentObservations.map((obs) => (
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

// ── Main Dashboard ───────────────────────────────────────

export default function Dashboard() {
  const { role } = useAuth()
  const [observations, setObservations] = useState<Observation[]>([])
  const [actions, setActions] = useState<ReductionAction[]>([])
  const [feedback, setFeedback] = useState<ActionFeedback[]>([])
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [obs, acts, fb, sugs] = await Promise.all([
        fetchObservations(),
        fetchActions(),
        fetchFeedback(),
        fetchSuggestions(),
      ])
      setObservations(obs)
      setActions(acts)
      setFeedback(fb)
      setSuggestions(sugs)
      setLoading(false)
    }
    load()
  }, [])

  // Still resolving user role — show loading state
  if (!role) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-surface-800">Dashboard</h2>
          <p className="text-sm text-surface-500 mt-1">Loading user profile…</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
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

  if (role === 'student') {
    return (
      <StudentDashboard
        observations={observations}
        feedback={feedback}
        loading={loading}
      />
    )
  }

  return (
    <EcoClubDashboard
      observations={observations}
      actions={actions}
      feedback={feedback}
      suggestions={suggestions}
      loading={loading}
    />
  )
}
