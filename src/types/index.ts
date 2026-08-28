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
