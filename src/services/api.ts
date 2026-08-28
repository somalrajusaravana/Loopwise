// ============================================================
// LoopWise API Layer
// Abstracts data access — uses Supabase when configured,
// falls back to mock data otherwise.
// ============================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import {
  MOCK_OBSERVATIONS,
  MOCK_ACTIONS,
  MOCK_FEEDBACK,
  MOCK_REPORTERS,
  CURRENT_USER,
} from '../mock/data'
import type { Observation, ReductionAction, ActionFeedback, PlasticCategory, CampusLocation } from '../types'
import type { Database } from '../types/supabase'

// ── Types for computed hotspots ─────────────────────────────

export interface ComputedHotspot {
  location: CampusLocation
  category: PlasticCategory
  observationCount: number
  uniqueReporters: number
  firstReported: string
  lastReported: string
  trend: 'increasing' | 'stable' | 'decreasing'
  reportIds: string[]
}

// ── Type mappers (DB row → app type) ────────────────────────

function mapObservation(row: Database['public']['Tables']['observations']['Row']): Observation {
  return {
    id: row.id,
    plasticCategory: row.plastic_category as PlasticCategory,
    location: row.location as CampusLocation,
    description: row.description ?? '',
    photoUrl: row.photo_storage_path ?? undefined,
    date: row.created_at,
    reporterName: MOCK_REPORTERS.find((r) => r.id === row.reporter_id)?.name ?? 'Unknown',
    reporterId: row.reporter_id ?? '',
    pHash: row.photo_phash ?? undefined,
    flaggedForReview: row.flagged_for_review,
    pointsAwarded: row.points_awarded,
  }
}

function mapAction(row: Database['public']['Tables']['reduction_actions']['Row']): ReductionAction {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    linkedHotspotId: '', // No longer a FK — computed from location+category
    linkedHotspotLocation: row.linked_hotspot_location ?? undefined,
    linkedHotspotCategory: row.linked_hotspot_category ?? undefined,
    sourceSuggestionId: row.source_suggestion_id ?? undefined,
    status: row.status,
    createdBy: MOCK_REPORTERS.find((r) => r.id === row.created_by)?.name ?? 'Eco Club',
    createdAt: row.created_at,
    assignedTo: row.assigned_to ?? 'Unassigned',
    startDate: row.start_date ?? undefined,
    completedDate: row.completed_date ?? undefined,
    notes: row.notes ?? [],
  }
}

function mapFeedback(row: Database['public']['Tables']['action_feedback']['Row']): ActionFeedback {
  return {
    id: row.id,
    actionId: row.action_id,
    reporterName: MOCK_REPORTERS.find((r) => r.id === row.reporter_id)?.name ?? 'Unknown',
    reporterId: row.reporter_id ?? '',
    sentiment: row.sentiment ?? 'neutral',
    comment: row.comment ?? '',
    photoUrl: row.photo_storage_path ?? undefined,
    date: row.created_at,
    location: (row.location ?? 'Other') as CampusLocation,
  }
}

// ============================================================
// API Functions
// ============================================================

// ── Observations ────────────────────────────────────────────

export async function fetchObservations(): Promise<Observation[]> {
  if (!isSupabaseConfigured()) {
    return [...MOCK_OBSERVATIONS]
  }

  const { data, error } = await supabase
    .from('observations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch observations:', error)
    return [...MOCK_OBSERVATIONS]
  }

  return data.map(mapObservation)
}

export async function createObservation(obs: {
  plasticCategory: PlasticCategory
  location: CampusLocation
  description?: string
  photoStoragePath?: string
  photoPhash?: string
  flaggedForReview?: boolean
  pointsAwarded?: number
}): Promise<Observation | null> {
  if (!isSupabaseConfigured()) {
    // Mock mode: create a local observation
    const newObs: Observation = {
      id: `obs-${Date.now()}`,
      plasticCategory: obs.plasticCategory,
      location: obs.location,
      description: obs.description ?? '',
      photoUrl: obs.photoStoragePath,
      date: new Date().toISOString(),
      reporterName: CURRENT_USER.name,
      reporterId: CURRENT_USER.id,
      pHash: obs.photoPhash,
      flaggedForReview: obs.flaggedForReview ?? false,
      pointsAwarded: obs.pointsAwarded ?? 10,
    }
    return newObs
  }

  const { data, error } = await supabase
    .from('observations')
    .insert({
      id: `obs-${Date.now()}`,
      plastic_category: obs.plasticCategory,
      location: obs.location,
      description: obs.description ?? null,
      photo_storage_path: obs.photoStoragePath ?? null,
      photo_phash: obs.photoPhash ?? null,
      flagged_for_review: obs.flaggedForReview ?? false,
      points_awarded: obs.pointsAwarded ?? 10,
      reporter_id: CURRENT_USER.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create observation:', error)
    return null
  }

  return mapObservation(data)
}

// ── Hotspot Computation ─────────────────────────────────────

export async function computeHotspots(): Promise<ComputedHotspot[]> {
  const observations = await fetchObservations()

  // Group by location + category
  const groups = new Map<string, { obs: Observation[]; location: CampusLocation; category: PlasticCategory }>()

  for (const obs of observations) {
    const key = `${obs.location}::${obs.plasticCategory}`
    if (!groups.has(key)) {
      groups.set(key, { obs: [], location: obs.location, category: obs.plasticCategory })
    }
    groups.get(key)!.obs.push(obs)
  }

  const hotspots: ComputedHotspot[] = []

  for (const [, group] of groups) {
    if (group.obs.length < 2) continue // Only patterns with 2+ reports

    const sorted = [...group.obs].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Compute trend: compare recent half vs older half
    const mid = Math.floor(sorted.length / 2)
    const olderHalf = sorted.slice(0, mid || 1)
    const recentHalf = sorted.slice(mid || 1)

    const olderSpan = olderHalf.length > 1
      ? (new Date(olderHalf[olderHalf.length - 1].date).getTime() - new Date(olderHalf[0].date).getTime()) / (1000 * 60 * 60 * 24)
      : 1
    const recentSpan = recentHalf.length > 1
      ? (new Date(recentHalf[recentHalf.length - 1].date).getTime() - new Date(recentHalf[0].date).getTime()) / (1000 * 60 * 60 * 24)
      : 1

    const olderRate = olderHalf.length / Math.max(olderSpan, 1)
    const recentRate = recentHalf.length / Math.max(recentSpan, 1)

    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    if (recentRate > olderRate * 1.3) trend = 'increasing'
    else if (recentRate < olderRate * 0.7) trend = 'decreasing'

    const uniqueReporters = new Set(group.obs.map((o) => o.reporterId)).size

    hotspots.push({
      location: group.location,
      category: group.category,
      observationCount: group.obs.length,
      uniqueReporters,
      firstReported: sorted[0].date.split('T')[0],
      lastReported: sorted[sorted.length - 1].date.split('T')[0],
      trend,
      reportIds: group.obs.map((o) => o.id),
    })
  }

  return hotspots.sort((a, b) => b.observationCount - a.observationCount)
}

// ── Actions ─────────────────────────────────────────────────

export async function fetchActions(): Promise<ReductionAction[]> {
  if (!isSupabaseConfigured()) {
    return [...MOCK_ACTIONS]
  }

  const { data, error } = await supabase
    .from('reduction_actions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch actions:', error)
    return [...MOCK_ACTIONS]
  }

  return data.map(mapAction)
}

export async function createAction(action: {
  title: string
  description?: string
  linkedHotspotLocation?: string
  linkedHotspotCategory?: string
  sourceSuggestionId?: string
  assignedTo?: string
}): Promise<ReductionAction | null> {
  if (!isSupabaseConfigured()) {
    const newAction: ReductionAction = {
      id: `act-${Date.now()}`,
      title: action.title,
      description: action.description ?? '',
      linkedHotspotId: '',
      linkedHotspotLocation: action.linkedHotspotLocation,
      linkedHotspotCategory: action.linkedHotspotCategory,
      sourceSuggestionId: action.sourceSuggestionId,
      status: 'suggested',
      createdBy: CURRENT_USER.name,
      createdAt: new Date().toISOString(),
      assignedTo: action.assignedTo ?? 'Unassigned',
      notes: [],
    }
    return newAction
  }

  // Try with source_suggestion_id first; fall back without it if column doesn't exist
  let insertData: Record<string, unknown> = {
    id: `act-${Date.now()}`,
    title: action.title,
    description: action.description ?? null,
    linked_hotspot_location: action.linkedHotspotLocation ?? null,
    linked_hotspot_category: action.linkedHotspotCategory ?? null,
    created_by: CURRENT_USER.id,
    assigned_to: action.assignedTo ?? 'Unassigned',
  }
  if (action.sourceSuggestionId) {
    insertData.source_suggestion_id = action.sourceSuggestionId
  }

  let { data, error } = await supabase
    .from('reduction_actions')
    .insert(insertData)
    .select()
    .single()

  // If insert failed (e.g. source_suggestion_id column doesn't exist yet), retry without it
  if (error && action.sourceSuggestionId) {
    delete insertData.source_suggestion_id
    const retry = await supabase
      .from('reduction_actions')
      .insert(insertData)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    console.error('Failed to create action:', error)
    return null
  }

  return mapAction(data)
}

export async function updateActionStatus(
  actionId: string,
  status: 'suggested' | 'adopted' | 'active' | 'completed'
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const updates: Record<string, unknown> = { status }
  if (status === 'active') updates.start_date = new Date().toISOString().split('T')[0]
  if (status === 'completed') updates.completed_date = new Date().toISOString().split('T')[0]

  const { error } = await supabase
    .from('reduction_actions')
    .update(updates)
    .eq('id', actionId)

  if (error) {
    console.error('Failed to update action:', error)
    return false
  }

  return true
}

// ── Feedback ────────────────────────────────────────────────

export async function fetchFeedback(): Promise<ActionFeedback[]> {
  if (!isSupabaseConfigured()) {
    return [...MOCK_FEEDBACK]
  }

  const { data, error } = await supabase
    .from('action_feedback')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch feedback:', error)
    return [...MOCK_FEEDBACK]
  }

  return data.map(mapFeedback)
}

export async function fetchFeedbackForAction(actionId: string): Promise<ActionFeedback[]> {
  if (!isSupabaseConfigured()) {
    return MOCK_FEEDBACK.filter((f) => f.actionId === actionId)
  }

  const { data, error } = await supabase
    .from('action_feedback')
    .select('*')
    .eq('action_id', actionId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch feedback:', error)
    return MOCK_FEEDBACK.filter((f) => f.actionId === actionId)
  }

  return data.map(mapFeedback)
}

export async function createFeedback(feedback: {
  actionId: string
  sentiment: 'positive' | 'neutral' | 'negative'
  comment: string
  photoStoragePath?: string
  location?: string
}): Promise<ActionFeedback | null> {
  if (!isSupabaseConfigured()) {
    const newFeedback: ActionFeedback = {
      id: `fb-${Date.now()}`,
      actionId: feedback.actionId,
      reporterName: CURRENT_USER.name,
      reporterId: CURRENT_USER.id,
      sentiment: feedback.sentiment,
      comment: feedback.comment,
      photoUrl: feedback.photoStoragePath,
      date: new Date().toISOString().split('T')[0],
      location: (feedback.location ?? 'Other') as CampusLocation,
    }
    return newFeedback
  }

  const { data, error } = await supabase
    .from('action_feedback')
    .insert({
      id: `fb-${Date.now()}`,
      action_id: feedback.actionId,
      sentiment: feedback.sentiment,
      comment: feedback.comment,
      photo_storage_path: feedback.photoStoragePath ?? null,
      location: feedback.location ?? null,
      reporter_id: CURRENT_USER.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create feedback:', error)
    return null
  }

  return mapFeedback(data)
}

// ── Suggestions ─────────────────────────────────────────────

export interface StudentSuggestion {
  id: string
  title: string
  explanation?: string
  relatedLocation?: string
  status: 'pending' | 'adopted' | 'dismissed'
  reporterId: string
  createdAt: string
}

export async function fetchSuggestions(): Promise<StudentSuggestion[]> {
  if (!isSupabaseConfigured()) {
    return [] // No mock suggestions — they were UI-only before
  }

  const { data, error } = await supabase
    .from('student_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch suggestions:', error)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    explanation: row.explanation ?? undefined,
    relatedLocation: row.related_location ?? undefined,
    status: row.status,
    reporterId: row.reporter_id ?? '',
    createdAt: row.created_at,
  }))
}

export async function createSuggestion(suggestion: {
  title: string
  explanation?: string
  relatedLocation?: string
}): Promise<StudentSuggestion | null> {
  if (!isSupabaseConfigured()) {
    return {
      id: `sug-${Date.now()}`,
      title: suggestion.title,
      explanation: suggestion.explanation,
      relatedLocation: suggestion.relatedLocation,
      status: 'pending',
      reporterId: CURRENT_USER.id,
      createdAt: new Date().toISOString(),
    }
  }

  const { data, error } = await supabase
    .from('student_suggestions')
    .insert({
      id: `sug-${Date.now()}`,
      title: suggestion.title,
      explanation: suggestion.explanation ?? null,
      related_location: suggestion.relatedLocation ?? null,
      reporter_id: CURRENT_USER.id,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create suggestion:', error)
    return null
  }

  return {
    id: data.id,
    title: data.title,
    explanation: data.explanation ?? undefined,
    relatedLocation: data.related_location ?? undefined,
    status: data.status,
    reporterId: data.reporter_id ?? '',
    createdAt: data.created_at,
  }
}

// ── Suggestion Management ─────────────────────────────────

export async function adoptSuggestion(suggestionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('student_suggestions')
    .update({ status: 'adopted' })
    .eq('id', suggestionId)

  if (error) {
    console.error('Failed to adopt suggestion:', error)
    return false
  }
  return true
}

export async function dismissSuggestion(suggestionId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { error } = await supabase
    .from('student_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', suggestionId)

  if (error) {
    console.error('Failed to dismiss suggestion:', error)
    return false
  }
  return true
}

// ── Dashboard Stats ─────────────────────────────────────────

export interface DashboardStats {
  totalObservations: number
  activeHotspots: number
  activeActions: number
  communityVerifiedActions: number
  recentActivity: Observation[]
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const observations = await fetchObservations()
  const actions = await fetchActions()
  const hotspots = await computeHotspots()

  return {
    totalObservations: observations.length,
    activeHotspots: hotspots.filter((h) => h.trend !== 'decreasing').length,
    activeActions: actions.filter((a) => a.status === 'active').length,
    communityVerifiedActions: actions.filter((a) => a.status === 'completed').length,
    recentActivity: observations.slice(0, 5),
  }
}

// ── Photo Upload ────────────────────────────────────────────

export async function uploadPhoto(
  bucket: 'observation-photos' | 'feedback-photos',
  file: File
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return URL.createObjectURL(file) // Mock: return blob URL
  }

  const filePath = `${CURRENT_USER.id}/${Date.now()}-${file.name}`

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, { contentType: file.type })

  if (error) {
    console.error('Failed to upload photo:', error)
    return null
  }

  return filePath
}

export function getPhotoUrl(bucket: 'observation-photos' | 'feedback-photos', path: string): string | null {
  if (!isSupabaseConfigured()) {
    return path // In mock mode, path is already a blob URL
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

// ── pHash Duplicate Check ───────────────────────────────────

export async function checkPHashDuplicate(newPHash: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !newPHash) return false

  const { data } = await supabase
    .from('observations')
    .select('id, photo_phash')
    .not('photo_phash', 'is', null)
    .limit(100)

  if (!data) return false

  // Simple Hamming distance check
  for (const row of data) {
    if (row.id && row.photo_phash) {
      const distance = hammingDistance(newPHash, row.photo_phash as string)
      if (distance <= 5) return true // 85%+ similarity
    }
  }

  return false
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length)
  let distance = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) distance++
  }
  return distance
}
