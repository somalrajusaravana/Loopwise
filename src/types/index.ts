// ── Track Module ──────────────────────────────────────────────

export type PlasticCategory =
  | 'straws'
  | 'cups-lids'
  | 'utensils'
  | 'bottles'
  | 'food-packaging'
  | 'bags'
  | 'containers'
  | 'other'

export type CampusLocation =
  | 'Dining Hall'
  | 'Student Center'
  | 'Library'
  | 'Gym'
  | 'Lecture Halls'
  | 'Dorms'
  | 'Outdoor Common Areas'
  | 'Café / Coffee Shop'
  | 'Administrative Building'
  | 'Parking Areas'
  | 'Other'

export interface Observation {
  id: string
  plasticCategory: PlasticCategory
  location: CampusLocation
  description: string
  photoUrl?: string
  date: string            // ISO 8601
  reporterName: string
  reporterId: string
  pHash?: string          // Perceptual hash for duplicate detection
  flaggedForReview: boolean
  pointsAwarded: number
  aiCategory?: PlasticCategory   // AI-predicted category (from Edge Function)
  aiConfidence?: number          // AI confidence score (0–1)
}

// ── Hotspot Module ───────────────────────────────────────────

export interface Hotspot {
  id: string
  location: CampusLocation
  category: PlasticCategory
  observationCount: number
  reportIds: string[]
  trend: 'increasing' | 'stable' | 'decreasing'
  firstReported: string
  lastReported: string
}

// ── Reduce Module ────────────────────────────────────────────

export type ActionStatus = 'suggested' | 'adopted' | 'active' | 'completed'

export interface ReductionAction {
  id: string
  title: string
  description: string
  linkedHotspotId: string
  linkedHotspotLocation?: string
  linkedHotspotCategory?: string
  sourceSuggestionId?: string  // Link to student suggestion if created from one
  status: ActionStatus
  createdBy: string
  createdAt: string
  assignedTo: string       // Team / person responsible
  startDate?: string
  completedDate?: string
  notes: string[]
}

// ── Community Confidence Engine ──────────────────────────────

export type ConfidenceState = 'low' | 'growing' | 'high' | 'verified'

export interface ActionFeedback {
  id: string
  actionId: string
  reporterName: string
  reporterId: string
  sentiment: 'positive' | 'neutral' | 'negative'
  comment: string
  photoUrl?: string
  date: string
  location: CampusLocation
}

export interface ConfidenceResult {
  state: ConfidenceState
  score: number             // 0–100
  independentContributors: number
  totalFeedback: number
  timeSpanDays: number
  uniqueLocations: number
  uniqueEvidenceCount: number
  breakdown: {
    independentContributorScore: number
    timeDistributionScore: number
    locationConsistencyScore: number
    evidenceUniquenessScore: number
    sentimentConsistencyScore: number
  }
}

// ── Dashboard ────────────────────────────────────────────────

export interface DashboardStats {
  totalObservations: number
  activeHotspots: number
  activeActions: number
  communityVerifiedActions: number
  recentActivity: Observation[]
}

// ── Points & Rewards ──────────────────────────────────────

export type PointReason =
  | 'verified_observation'
  | 'weekly_streak_bonus'
  | 'suggestion_adopted'
  | 'feedback_submitted'
  | 'before_after_bonus'
  | 'daily_checkin'

export type PointReferenceType =
  | 'observation'
  | 'suggestion'
  | 'feedback'
  | 'checkin'
  | 'streak'

export interface PointsLogEntry {
  id: string
  userId: string
  points: number
  reason: PointReason
  referenceId: string
  referenceType: PointReferenceType
  createdAt: string
}

export interface DailyCheckin {
  id: string
  userId: string
  checkinType: 'observation' | 'nothing_to_report'
  checkinDate: string  // YYYY-MM-DD
  observationId?: string
  createdAt: string
}

export interface StreakInfo {
  currentStreak: number
  longestStreak: number
  todayCheckedIn: boolean
  todayCheckinType?: 'observation' | 'nothing_to_report'
  daysUntilBonus: number
}

// ── Point Values (centralized) ────────────────────────────

export const POINT_VALUES = {
  verified_observation: 10,
  weekly_streak_bonus: 15,
  suggestion_adopted: 10,
  feedback_submitted: 5,
  before_after_bonus: 15,
  daily_checkin: 2,
} as const

// Anti-spam: max observations per student per day
export const DAILY_OBSERVATION_LIMIT = 5
