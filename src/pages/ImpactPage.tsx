import { useState, useEffect } from 'react'
import type { Observation, ReductionAction, ActionFeedback } from '../types'
import { calculateConfidence } from '../services/confidence-engine'
import {
  fetchObservations,
  fetchActions,
  fetchFeedback,
  computeHotspots,
  fetchPlasticLogs,
  fetchCampusLocations,
  type ComputedHotspot,
  type PlasticLog,
  type CampusLocationEntry,
} from '../services/api'

export default function ImpactPage() {
  const [observations, setObservations] = useState<Observation[]>([])
  const [actions, setActions] = useState<ReductionAction[]>([])
  const [feedback, setFeedback] = useState<ActionFeedback[]>([])
  const [hotspots, setHotspots] = useState<ComputedHotspot[]>([])
  const [plasticLogs, setPlasticLogs] = useState<PlasticLog[]>([])
  const [campusLocations, setCampusLocations] = useState<CampusLocationEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [obs, acts, fb, hs, logs, locations] = await Promise.all([
        fetchObservations(),
        fetchActions(),
        fetchFeedback(),
        computeHotspots(),
        fetchPlasticLogs(),
        fetchCampusLocations(),
      ])
      setObservations(obs)
      setActions(acts)
      setFeedback(fb)
      setHotspots(hs)
      setPlasticLogs(logs)
      setCampusLocations(locations)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-surface-800">Impact</h2>
          <p className="text-sm text-surface-500 mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
              <div className="h-3 bg-surface-200 rounded w-24" />
              <div className="h-8 bg-surface-200 rounded w-12 mt-2" />
              <div className="h-3 bg-surface-200 rounded w-28 mt-2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Compute metrics from actual data
  const totalObservations = observations.length
  const uniqueReporters = new Set(observations.map((o) => o.reporterId)).size
  const hotspotsIdentified = hotspots.length
  const activeHotspots = hotspots.filter(
    (h) => h.trend !== 'decreasing'
  ).length

  const suggestedActions = actions.filter((a) => a.status === 'suggested').length
  const adoptedActions = actions.filter((a) => a.status === 'adopted').length
  const activeActions = actions.filter((a) => a.status === 'active').length
  const completedActions = actions.filter((a) => a.status === 'completed').length
  const totalActions = actions.length

  const actionsWithConfidence = actions
    .filter((a) => a.status === 'active' || a.status === 'completed')
    .map((a) => ({
      action: a,
      confidence: calculateConfidence(
        feedback.filter((f) => f.actionId === a.id)
      ),
    }))

  const avgConfidence =
    actionsWithConfidence.length > 0
      ? Math.round(
          actionsWithConfidence.reduce(
            (sum, a) => sum + a.confidence.score,
            0
          ) / actionsWithConfidence.length
        )
      : 0

  const totalFeedback = feedback.length
  const uniqueFeedbackAuthors = new Set(
    feedback.map((f) => f.reporterId)
  ).size

  const reuseInitiatives = actions.filter(
    (a) => a.status === 'completed' || a.status === 'active'
  ).length

  // Plastic logs metrics
  const totalPlasticItems = plasticLogs.reduce((sum, log) => sum + log.quantity, 0)
  const totalEstimatedWeight = plasticLogs.reduce((sum, log) => sum + log.estimatedWeightG, 0)
  const uniqueLogLocations = new Set(plasticLogs.map((l) => l.locationId)).size
  const campusLocationMap = new Map(campusLocations.map((l) => [l.id, l.name]))

  const metrics = [
    {
      label: 'Community Observations',
      value: totalObservations,
      sublabel: `From ${uniqueReporters} unique reporters`,
      color: 'brand',
    },
    {
      label: 'Hotspots Identified',
      value: hotspotsIdentified,
      sublabel: `${activeHotspots} still active`,
      color: 'amber',
    },
    {
      label: 'Eco Club Actions',
      value: totalActions,
      sublabel: `${completedActions} completed, ${activeActions} active`,
      color: 'blue',
    },
    {
      label: 'Reuse Initiatives',
      value: reuseInitiatives,
      sublabel: 'Sustainable alternatives in place',
      color: 'emerald',
    },
  ]

  const participationMetrics = [
    {
      label: 'Student Reporters',
      value: uniqueReporters,
      description: 'Unique students who submitted observations',
    },
    {
      label: 'Community Feedback',
      value: totalFeedback,
      description: `From ${uniqueFeedbackAuthors} independent contributors`,
    },
    {
      label: 'Avg. Confidence Score',
      value: `${avgConfidence}/100`,
      description: 'Across all active and completed actions',
    },
  ]

  const plasticLogsMetrics = [
    {
      label: 'Plastic Items Logged',
      value: totalPlasticItems,
      description: `Across ${plasticLogs.length} log entries`,
    },
    {
      label: 'Est. Weight Tracked',
      value: totalEstimatedWeight >= 1000
        ? `${(totalEstimatedWeight / 1000).toFixed(1)}kg`
        : `${Math.round(totalEstimatedWeight)}g`,
      description: 'Community-reported plastic waste estimate',
    },
    {
      label: 'Locations Monitored',
      value: uniqueLogLocations,
      description: `${campusLocations.length} campus locations registered`,
    },
  ]

  const actionBreakdown = [
    { label: 'Suggested', count: suggestedActions, icon: '💡', color: 'text-surface-600' },
    { label: 'Adopted', count: adoptedActions, icon: '🤝', color: 'text-blue-600' },
    { label: 'Active', count: activeActions, icon: '🟢', color: 'text-brand-600' },
    { label: 'Completed', count: completedActions, icon: '✅', color: 'text-emerald-600' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-surface-800">Impact</h2>
        <p className="text-sm text-surface-500 mt-1">
          Collective progress driven by the campus community
        </p>
      </div>

      {/* Principle note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        ℹ All metrics below are based on observations and feedback shared by the campus community.
        LoopWise does not claim exact environmental impact — these numbers reflect community-driven participation.
      </div>

      {/* Core Metrics Grid */}
      <div>
        <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-3">
          Community-Driven Progress
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="bg-white rounded-xl border border-surface-200 p-5"
            >
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                {m.label}
              </p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  m.color === 'brand'
                    ? 'text-brand-600'
                    : m.color === 'amber'
                    ? 'text-amber-600'
                    : m.color === 'blue'
                    ? 'text-blue-600'
                    : 'text-emerald-600'
                }`}
              >
                {m.value}
              </p>
              <p className="text-xs text-surface-400 mt-1">{m.sublabel}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Participation */}
      <div>
        <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-3">
          Community Participation
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {participationMetrics.map((m) => (
            <div
              key={m.label}
              className="bg-white rounded-xl border border-surface-200 p-5"
            >
              <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                {m.label}
              </p>
              <p className="text-2xl font-bold text-surface-800 mt-1">
                {m.value}
              </p>
              <p className="text-xs text-surface-400 mt-1">{m.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plastic Waste Tracking */}
      {plasticLogs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-3">
            Plastic Waste Tracking
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {plasticLogsMetrics.map((m) => (
              <div
                key={m.label}
                className="bg-white rounded-xl border border-surface-200 p-5"
              >
                <p className="text-xs font-medium text-surface-400 uppercase tracking-wide">
                  {m.label}
                </p>
                <p className="text-2xl font-bold text-surface-800 mt-1">
                  {m.value}
                </p>
                <p className="text-xs text-surface-400 mt-1">{m.description}</p>
              </div>
            ))}
          </div>
          {/* Recent plastic log entries */}
          <div className="bg-white rounded-xl border border-surface-200 p-5 mt-4">
            <p className="text-xs font-medium text-surface-500 mb-3">Recent Community-Logged Plastic Items</p>
            <div className="space-y-2">
              {plasticLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="flex items-center gap-3 text-xs">
                  <span className="font-medium text-surface-700 w-32 truncate">{log.itemName}</span>
                  <span className="text-surface-400">×{log.quantity}</span>
                  <span className="text-surface-400">•</span>
                  <span className="text-surface-500">
                    {campusLocationMap.get(log.locationId) ?? 'Unknown location'}
                  </span>
                  <span className="text-surface-400">•</span>
                  <span className="text-surface-400">~{log.estimatedWeightG}g</span>
                  <span className={`ml-auto px-2 py-0.5 rounded-full font-medium ${
                    log.source === 'ai_assisted'
                      ? 'bg-blue-50 text-blue-600 border border-blue-200'
                      : 'bg-surface-100 text-surface-500 border border-surface-200'
                  }`}>
                    {log.source === 'ai_assisted' ? 'AI Assisted' : 'Manual'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Lifecycle Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-3">
          Action Lifecycle
        </h3>
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <div className="grid grid-cols-4 gap-4">
            {actionBreakdown.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-2xl">{item.icon}</p>
                <p className={`text-2xl font-bold mt-1 ${item.color}`}>
                  {item.count}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
          {/* Visual bar */}
          <div className="mt-4 flex rounded-full overflow-hidden h-3">
            {actionBreakdown.map((item) => {
              const width = totalActions > 0 ? (item.count / totalActions) * 100 : 0
              if (width === 0) return null
              const bgColor =
                item.label === 'Suggested'
                  ? 'bg-surface-300'
                  : item.label === 'Adopted'
                  ? 'bg-blue-400'
                  : item.label === 'Active'
                  ? 'bg-brand-400'
                  : 'bg-emerald-400'
              return (
                <div
                  key={item.label}
                  className={`${bgColor} transition-all`}
                  style={{ width: `${width}%` }}
                  title={`${item.label}: ${item.count}`}
                />
              )
            })}
          </div>
          <p className="text-xs text-surface-400 text-center mt-2">
            {totalActions} total actions across all lifecycle stages
          </p>
        </div>
      </div>

      {/* Confidence Overview */}
      <div>
        <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-3">
          Community Confidence Across Actions
        </h3>
        <div className="space-y-3">
          {actionsWithConfidence.map(({ action, confidence }) => (
            <div
              key={action.id}
              className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">
                  {action.title}
                </p>
                <p className="text-xs text-surface-400 mt-0.5">
                  {action.status} • {confidence.independentContributors} contributors
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="w-24 bg-surface-100 rounded-full h-2">
                  <div
                    className="bg-brand-500 h-2 rounded-full transition-all"
                    style={{ width: `${confidence.score}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-surface-800 w-10 text-right">
                  {confidence.score}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The LoopWise Story */}
      <div className="bg-surface-50 rounded-xl border border-surface-200 p-6">
        <h3 className="text-sm font-semibold text-surface-800 mb-3">
          The LoopWise Journey
        </h3>
        <div className="flex items-center gap-2 text-xs text-surface-500 flex-wrap">
          <span className="bg-white px-2 py-1 rounded border border-surface-200">
            📸 Track
          </span>
          <span>→</span>
          <span className="bg-white px-2 py-1 rounded border border-surface-200">
            ⬡ Identify Hotspots
          </span>
          <span>→</span>
          <span className="bg-white px-2 py-1 rounded border border-surface-200">
            ↓ Reduce
          </span>
          <span>→</span>
          <span className="bg-white px-2 py-1 rounded border border-surface-200">
            ♻️ Reuse
          </span>
          <span>→</span>
          <span className="bg-white px-2 py-1 rounded border border-surface-200">
            📈 Impact
          </span>
          <span>→</span>
          <span className="bg-brand-50 px-2 py-1 rounded border border-brand-200 text-brand-700 font-medium">
            🔄 Continuous Improvement
          </span>
        </div>
      </div>
    </div>
  )
}
