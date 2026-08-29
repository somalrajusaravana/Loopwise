import { useState, useEffect } from 'react'
import type { ReductionAction, CampusLocation, ActionFeedback as FeedbackType, Observation } from '../types'
import ConfidenceBadge from '../components/Confidence/ConfidenceBadge'
import { calculateConfidence } from '../services/confidence-engine'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchActions,
  fetchFeedback,
  createFeedback,
  fetchObservations,
  fetchReuseListings,
  fetchReuseRequests,
  fetchCampusLocations,
  type ReuseListing,
  type ReuseRequest,
  type CampusLocationEntry,
} from '../services/api'
import { rewardFeedback } from '../services/points-engine'

// Reuse initiatives derived from completed/active actions
interface ReuseInitiative {
  id: string
  name: string
  location: string
  alternative: string
  linkedAction: ReductionAction
  status: 'Implemented' | 'Growing' | 'Community Verified'
  communityUpdate: string
}

// Known initiative overrides for seeded actions (preserves polished display text)
const KNOWN_INITIATIVES: Record<string, { name: string; alternative: string; communityUpdate: string }> = {
  'act-001': {
    name: '♻️ Compostable Cups at Dining Hall',
    alternative: 'Compostable cups and lids replacing single-use plastic',
    communityUpdate:
      'Community feedback indicates compostable cups are now available in the south dining area. Multiple independent students have confirmed the switch. Some reports note the back section still has plastic cups.',
  },
  'act-004': {
    name: '🛍️ Paper Bags at Campus Bookstore',
    alternative: 'Paper bags with reusable bag discount option',
    communityUpdate:
      'Students report the bookstore has fully transitioned to paper bags. A sign promoting the reusable bag option is visible at checkout. Community feedback suggests the change is working well.',
  },
}

function buildInitiatives(
  actions: ReductionAction[],
  feedback: FeedbackType[]
): ReuseInitiative[] {
  const initiatives: ReuseInitiative[] = []

  const completedOrActive = actions.filter(
    (a) => a.status === 'completed' || a.status === 'active'
  )

  for (const action of completedOrActive) {
    const actionFeedback = feedback.filter((f) => f.actionId === action.id)
    const confidence = calculateConfidence(actionFeedback)

    let status: ReuseInitiative['status']
    if (confidence.state === 'verified') status = 'Community Verified'
    else if (confidence.state === 'high') status = 'Growing'
    else status = 'Implemented'

    const known = KNOWN_INITIATIVES[action.id]

    const name = known?.name ?? `♻️ ${action.title}`
    const location = action.linkedHotspotLocation ?? 'Campus'
    const alternative = known?.alternative ?? (action.description || 'Sustainable initiative in progress')

    // Dynamic community update from real feedback data
    const communityUpdate = known?.communityUpdate ?? generateCommunityUpdate(actionFeedback, action)

    initiatives.push({
      id: `reuse-${action.id}`,
      name,
      location,
      alternative,
      linkedAction: action,
      status,
      communityUpdate,
    })
  }

  return initiatives
}

function generateCommunityUpdate(feedback: FeedbackType[], action: ReductionAction): string {
  if (feedback.length === 0) {
    return 'This initiative has been implemented. Community feedback will appear here as students share their observations.'
  }

  const positive = feedback.filter((f) => f.sentiment === 'positive').length
  const negative = feedback.filter((f) => f.sentiment === 'negative').length
  const contributors = new Set(feedback.map((f) => f.reporterId)).size

  let summary = `${contributors} student${contributors !== 1 ? 's' : ''} have shared feedback about this initiative.`

  if (positive > 0 && negative === 0) {
    summary += ` All reports are positive — the community confirms the ${action.linkedHotspotLocation ?? 'initiative'} change is working.`
  } else if (negative > 0 && positive === 0) {
    summary += ` Reports indicate the initiative may not be fully implemented yet.`
  } else if (positive > negative) {
    summary += ` Most feedback is positive, though some concerns have been noted.`
  } else {
    summary += ` Feedback is mixed — the Eco Club may want to review the community response.`
  }

  return summary
}

export default function ReusePage() {
  const { role, appUser } = useAuth()
  const [initiatives, setInitiatives] = useState<ReuseInitiative[]>([])
  const [loading, setLoading] = useState(true)

  // Feedback form state
  const [feedbackActionId, setFeedbackActionId] = useState<string | null>(null)
  const [feedbackSentiment, setFeedbackSentiment] = useState<'positive' | 'neutral' | 'negative'>('positive')
  const [feedbackComment, setFeedbackComment] = useState('')
  const [feedbackPhoto, setFeedbackPhoto] = useState<File | null>(null)
  const [feedbackLocation, setFeedbackLocation] = useState<CampusLocation | ''>('')
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)
  const [localFeedback, setLocalFeedback] = useState<FeedbackType[]>([])
  const [fetchedFeedback, setFetchedFeedback] = useState<FeedbackType[]>([])
  const [allActions, setAllActions] = useState<ReductionAction[]>([])
  const [allObservations, setAllObservations] = useState<Observation[]>([])
  const [reuseListings, setReuseListings] = useState<ReuseListing[]>([])
  const [reuseRequests, setReuseRequests] = useState<ReuseRequest[]>([])
  const [campusLocations, setCampusLocations] = useState<CampusLocationEntry[]>([])

  useEffect(() => {
    async function load() {
      const [actions, feedback, observations, listings, requests, locations] = await Promise.all([
        fetchActions(),
        fetchFeedback(),
        fetchObservations(),
        fetchReuseListings(),
        fetchReuseRequests(),
        fetchCampusLocations(),
      ])
      setAllActions(actions)
      setAllObservations(observations)
      setFetchedFeedback(feedback)
      setInitiatives(buildInitiatives(actions, feedback))
      setReuseListings(listings)
      setReuseRequests(requests)
      setCampusLocations(locations)
      setLoading(false)
    }
    load()
  }, [])

  async function handleFeedbackSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!feedbackActionId || !feedbackComment.trim()) return

    const newFeedback = await createFeedback({
      actionId: feedbackActionId,
      sentiment: feedbackSentiment,
      comment: feedbackComment.trim(),
      photoFile: feedbackPhoto ?? undefined,
      location: feedbackLocation || undefined,
      userId: appUser?.id ?? '',
    })

    if (newFeedback) {
      setLocalFeedback((prev) => [newFeedback, ...prev])

      // Award feedback points + check Before → After bonus
      await rewardFeedback(newFeedback, allObservations, allActions)
    }

    // Re-fetch feedback from Supabase to ensure persistence
    const refreshedFeedback = await fetchFeedback()
    setFetchedFeedback(refreshedFeedback)
    setLocalFeedback([]) // Clear optimistic state since fetchedFeedback now has everything

    setFeedbackActionId(null)
    setFeedbackComment('')
    setFeedbackPhoto(null)
    setFeedbackLocation('')
    setFeedbackSuccess(true)
    setTimeout(() => setFeedbackSuccess(false), 3000)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-surface-800">Reuse</h2>
          <p className="text-sm text-surface-500 mt-1">Loading...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-48" />
              <div className="h-3 bg-surface-200 rounded w-32 mt-2" />
              <div className="h-16 bg-surface-200 rounded mt-4" />
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
        <h2 className="text-2xl font-bold text-surface-800">Reuse</h2>
        <p className="text-sm text-surface-500 mt-1">
          Sustainable alternatives introduced through community-driven action
        </p>
      </div>

      {/* Principle note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        ℹ Reuse initiatives are validated through community feedback and the
        Community Confidence Engine. Impact statements are based on community
        reports, not exact measurements.
      </div>

      {/* Success message */}
      {feedbackSuccess && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 text-sm text-brand-700">
          ✓ Feedback submitted! Your independent observation helps build
          community confidence.
        </div>
      )}

      {/* Initiatives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {initiatives.map((initiative) => {
          // Merge fetched + local feedback, deduplicate by id
          const allFeedbackRaw = [
            ...fetchedFeedback.filter(
              (f) => f.actionId === initiative.linkedAction.id
            ),
            ...localFeedback.filter(
              (f) => f.actionId === initiative.linkedAction.id
            ),
          ]
          const seen = new Set<string>()
          const allFeedback = allFeedbackRaw.filter((f) => {
            if (seen.has(f.id)) return false
            seen.add(f.id)
            return true
          })
          const confidence = calculateConfidence(allFeedback)
          const isShowingFeedbackForm = feedbackActionId === initiative.linkedAction.id

          return (
            <div
              key={initiative.id}
              className="bg-white rounded-xl border border-surface-200 p-5"
            >
              {/* Title + Status */}
              <div className="flex items-start justify-between">
                <h3 className="text-base font-semibold text-surface-800">
                  {initiative.name}
                </h3>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    initiative.status === 'Community Verified'
                      ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                      : initiative.status === 'Growing'
                      ? 'text-brand-600 bg-brand-50 border border-brand-200'
                      : 'text-blue-600 bg-blue-50 border border-blue-200'
                  }`}
                >
                  {initiative.status}
                </span>
              </div>

              {/* Location + Alternative */}
              <p className="text-xs text-surface-400 mt-1">
                📍 {initiative.location}
              </p>
              <p className="text-sm text-surface-600 mt-2">
                <span className="font-medium text-surface-700">
                  Alternative:
                </span>{' '}
                {initiative.alternative}
              </p>

              {/* Community Confidence */}
              <div className="mt-4 bg-surface-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-surface-500">
                    Community Confidence
                  </span>
                  <ConfidenceBadge state={confidence.state} />
                </div>
                <div className="w-full bg-surface-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-brand-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${confidence.score}%` }}
                  />
                </div>
                <p className="text-xs text-surface-400 mt-1">
                  {confidence.independentContributors} independent contributors{' '}
                  • {confidence.score}/100
                </p>
              </div>

              {/* Community Update */}
              <div className="mt-4 border-t border-surface-100 pt-3">
                <p className="text-xs font-medium text-surface-500 mb-1">
                  Community Update
                </p>
                <p className="text-xs text-surface-600 leading-relaxed">
                  {initiative.communityUpdate}
                </p>
              </div>

              {/* Recent Feedback Snippets */}
              {allFeedback.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-surface-500 mb-2">
                    Recent Community Feedback
                  </p>
                  <div className="space-y-2">
                    {allFeedback.slice(-3).reverse().map((fb) => (
                      <div
                        key={fb.id}
                        className="bg-surface-50 rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-surface-700">
                            {fb.reporterName}
                          </span>
                          <span
                            className={`text-xs ${
                              fb.sentiment === 'positive'
                                ? 'text-emerald-600'
                                : fb.sentiment === 'negative'
                                ? 'text-red-500'
                                : 'text-surface-400'
                            }`}
                          >
                            {fb.sentiment === 'positive'
                              ? '👍'
                              : fb.sentiment === 'negative'
                              ? '👎'
                              : '🤔'}
                          </span>
                          <span className="text-xs text-surface-400">
                            {new Date(fb.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-surface-600 leading-relaxed">
                          {fb.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Action */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-surface-400">
                  Linked action:
                </span>
                <span className="text-xs text-surface-600 font-medium">
                  {initiative.linkedAction.title}
                </span>
              </div>

              {/* Student Feedback Button */}
              {role === 'student' && (
                <div className="mt-4 border-t border-surface-100 pt-3">
                  {!isShowingFeedbackForm ? (
                    <button
                      onClick={() =>
                        setFeedbackActionId(initiative.linkedAction.id)
                      }
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      📝 Share your feedback on this initiative
                    </button>
                  ) : (
                    <form
                      onSubmit={handleFeedbackSubmit}
                      className="space-y-3"
                    >
                      <p className="text-xs font-medium text-surface-500">
                        Your Feedback
                      </p>

                      {/* Sentiment */}
                      <div className="flex gap-2">
                        {(['positive', 'neutral', 'negative'] as const).map(
                          (s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setFeedbackSentiment(s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                feedbackSentiment === s
                                  ? s === 'positive'
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                                    : s === 'neutral'
                                    ? 'bg-surface-100 text-surface-700 border border-surface-300'
                                    : 'bg-red-100 text-red-700 border border-red-300'
                                  : 'bg-surface-50 text-surface-400 border border-surface-200 hover:bg-surface-100'
                              }`}
                            >
                              {s === 'positive'
                                ? '👍 Positive'
                                : s === 'neutral'
                                ? '🤔 Neutral'
                                : '👎 Negative'}
                            </button>
                          )
                        )}
                      </div>

                      {/* Comment */}
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        rows={2}
                        maxLength={300}
                        placeholder="What did you observe about this initiative?"
                        className="w-full border border-surface-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
                        required
                      />

                      {/* Photo */}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            setFeedbackPhoto(e.target.files?.[0] ?? null)
                          }
                          className="hidden"
                          id={`feedback-photo-${initiative.id}`}
                        />
                        <label
                          htmlFor={`feedback-photo-${initiative.id}`}
                          className="text-xs text-surface-500 hover:text-brand-600 cursor-pointer transition-colors"
                        >
                          📷{' '}
                          {feedbackPhoto
                            ? feedbackPhoto.name
                            : 'Add photo evidence (optional)'}
                        </label>
                      </div>

                      {/* Location */}
                      <select
                        value={feedbackLocation}
                        onChange={(e) =>
                          setFeedbackLocation(e.target.value as CampusLocation)
                        }
                        className="w-full border border-surface-300 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                      >
                        <option value="">Location (optional)</option>
                        {[
                          'Dining Hall',
                          'Student Center',
                          'Library',
                          'Gym',
                          'Café / Coffee Shop',
                        ].map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>

                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={!feedbackComment.trim()}
                          className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Submit Feedback
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFeedbackActionId(null)
                            setFeedbackComment('')
                            setFeedbackPhoto(null)
                          }}
                          className="px-3 py-1.5 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {initiatives.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl text-surface-300">♻️</p>
          <p className="text-sm text-surface-500 mt-3">
            No reuse initiatives yet
          </p>
          <p className="text-xs text-surface-400 mt-1">
            Initiatives will appear here as Eco Club actions are completed
          </p>
        </div>
      )}

      {/* Community Reuse Listings */}
      {reuseListings.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-surface-800 mb-2">
            🔄 Available Reuse Items
          </h3>
          <p className="text-xs text-surface-400 mb-4">
            Items shared by the campus community for reuse
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reuseListings.map((listing) => {
              const locationName = campusLocations.find((l) => l.id === listing.locationId)?.name ?? 'Campus'
              const requestCount = reuseRequests.filter((r) => r.listingId === listing.id).length
              const pendingRequests = reuseRequests.filter((r) => r.listingId === listing.id && r.status === 'pending').length

              return (
                <div
                  key={listing.id}
                  className="bg-white rounded-xl border border-surface-200 p-5"
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-sm font-semibold text-surface-800">
                      {listing.itemName}
                    </h4>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        listing.status === 'available'
                          ? 'text-emerald-600 bg-emerald-50 border border-emerald-200'
                          : listing.status === 'reserved'
                          ? 'text-amber-600 bg-amber-50 border border-amber-200'
                          : 'text-surface-600 bg-surface-100 border border-surface-200'
                      }`}
                    >
                      {listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-surface-400 mt-1">
                    📍 {locationName}
                  </p>
                  <p className="text-sm text-surface-600 mt-2">
                    {listing.description}
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-surface-400">
                    <span>Qty: {listing.quantity}</span>
                    <span>Condition: {listing.condition}</span>
                    {requestCount > 0 && (
                      <span className="text-brand-600 font-medium">
                        {requestCount} request{requestCount !== 1 ? 's' : ''}{pendingRequests > 0 ? ` (${pendingRequests} pending)` : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
