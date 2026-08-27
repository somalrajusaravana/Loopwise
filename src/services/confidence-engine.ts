import type {
  ActionFeedback,
  ConfidenceResult,
  ConfidenceState,
} from '../types'

// ── Weights for each confidence factor ───────────────────────

const WEIGHTS = {
  independentContributors: 0.30,
  timeDistribution: 0.15,
  locationConsistency: 0.15,
  evidenceUniqueness: 0.20,
  sentimentConsistency: 0.20,
}

// ── Scoring Functions ────────────────────────────────────────

/**
 * Score based on number of unique independent contributors.
 * Minimum 3 independent contributors required for any confidence.
 */
function scoreIndependentContributors(feedback: ActionFeedback[]): number {
  const uniqueContributors = new Set(feedback.map((f) => f.reporterId)).size

  if (uniqueContributors <= 1) return 0
  if (uniqueContributors === 2) return 25
  if (uniqueContributors === 3) return 50
  if (uniqueContributors <= 5) return 75
  return 100
}

/**
 * Score based on time distribution of feedback.
 * Feedback spread over multiple days indicates sustained observation.
 */
function scoreTimeDistribution(feedback: ActionFeedback[]): number {
  if (feedback.length <= 1) return 0

  const dates = [...new Set(feedback.map((f) => f.date))].sort()
  if (dates.length <= 1) return 20

  const first = new Date(dates[0])
  const last = new Date(dates[dates.length - 1])
  const daySpan = Math.max(1, (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24))

  if (daySpan < 1) return 20
  if (daySpan < 3) return 40
  if (daySpan < 7) return 65
  return 100
}

/**
 * Score based on location consistency.
 * Feedback from the same location as the action is stronger evidence.
 */
function scoreLocationConsistency(feedback: ActionFeedback[]): number {
  if (feedback.length === 0) return 0

  const locationCounts: Record<string, number> = {}
  for (const f of feedback) {
    locationCounts[f.location] = (locationCounts[f.location] || 0) + 1
  }

  const maxCount = Math.max(...Object.values(locationCounts))
  const ratio = maxCount / feedback.length

  // High concentration in same location = good consistency
  if (ratio >= 0.8) return 100
  if (ratio >= 0.6) return 70
  if (ratio >= 0.4) return 40
  return 20
}

/**
 * Score based on uniqueness of evidence (photos, comments).
 */
function scoreEvidenceUniqueness(feedback: ActionFeedback[]): number {
  if (feedback.length === 0) return 0

  const withPhotos = feedback.filter((f) => f.photoUrl).length
  const uniqueComments = new Set(
    feedback.map((f) => f.comment.toLowerCase().trim())
  ).size

  let score = 0

  // Photo evidence bonus
  if (withPhotos >= 3) score += 50
  else if (withPhotos >= 2) score += 35
  else if (withPhotos >= 1) score += 20

  // Comment uniqueness bonus
  const commentRatio = uniqueComments / feedback.length
  if (commentRatio >= 0.8) score += 50
  else if (commentRatio >= 0.6) score += 35
  else if (commentRatio >= 0.4) score += 20
  else score += 10

  return Math.min(100, score)
}

/**
 * Score based on consistency of sentiment.
 * Most feedback should be positive for high confidence.
 */
function scoreSentimentConsistency(feedback: ActionFeedback[]): number {
  if (feedback.length === 0) return 0

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
  for (const f of feedback) {
    sentimentCounts[f.sentiment]++
  }

  const positiveRatio = sentimentCounts.positive / feedback.length
  const negativeRatio = sentimentCounts.negative / feedback.length

  if (negativeRatio > 0.3) return 10
  if (positiveRatio >= 0.8) return 100
  if (positiveRatio >= 0.6) return 70
  if (positiveRatio >= 0.4) return 40
  return 20
}

// ── Main Engine ──────────────────────────────────────────────

export function calculateConfidence(
  actionFeedback: ActionFeedback[]
): ConfidenceResult {
  const independentContributors = new Set(
    actionFeedback.map((f) => f.reporterId)
  ).size

  const dates = [...new Set(actionFeedback.map((f) => f.date))].sort()
  const timeSpanDays =
    dates.length > 1
      ? Math.max(
          1,
          (new Date(dates[dates.length - 1]).getTime() -
            new Date(dates[0]).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0

  const uniqueLocations = new Set(actionFeedback.map((f) => f.location)).size
  const uniqueEvidenceCount = new Set(
    actionFeedback.map((f) => f.comment.toLowerCase().trim())
  ).size

  const breakdown = {
    independentContributorScore: scoreIndependentContributors(actionFeedback),
    timeDistributionScore: scoreTimeDistribution(actionFeedback),
    locationConsistencyScore: scoreLocationConsistency(actionFeedback),
    evidenceUniquenessScore: scoreEvidenceUniqueness(actionFeedback),
    sentimentConsistencyScore: scoreSentimentConsistency(actionFeedback),
  }

  // Weighted total
  const score =
    breakdown.independentContributorScore * WEIGHTS.independentContributors +
    breakdown.timeDistributionScore * WEIGHTS.timeDistribution +
    breakdown.locationConsistencyScore * WEIGHTS.locationConsistency +
    breakdown.evidenceUniquenessScore * WEIGHTS.evidenceUniqueness +
    breakdown.sentimentConsistencyScore * WEIGHTS.sentimentConsistency

  const state = determineState(score, independentContributors)

  return {
    state,
    score: Math.round(score),
    independentContributors,
    totalFeedback: actionFeedback.length,
    timeSpanDays: Math.round(timeSpanDays),
    uniqueLocations,
    uniqueEvidenceCount,
    breakdown,
  }
}

function determineState(
  score: number,
  independentContributors: number
): ConfidenceState {
  // Safety gate: no single student can verify
  if (independentContributors <= 1) return 'low'

  if (score >= 75 && independentContributors >= 5) return 'verified'
  if (score >= 55 && independentContributors >= 3) return 'high'
  if (score >= 30 && independentContributors >= 2) return 'growing'
  return 'low'
}

// ── UI Helpers ───────────────────────────────────────────────

export const CONFIDENCE_LABELS: Record<ConfidenceState, string> = {
  low: 'Low Confidence',
  growing: 'Growing Confidence',
  high: 'High Confidence',
  verified: 'Community Verified',
}

export const CONFIDENCE_COLORS: Record<ConfidenceState, string> = {
  low: 'text-red-500 bg-red-50 border-red-200',
  growing: 'text-amber-600 bg-amber-50 border-amber-200',
  high: 'text-brand-600 bg-brand-50 border-brand-200',
  verified: 'text-emerald-600 bg-emerald-50 border-emerald-200',
}

export const CONFIDENCE_ICONS: Record<ConfidenceState, string> = {
  low: '○',
  growing: '◐',
  high: '●',
  verified: '★',
}
