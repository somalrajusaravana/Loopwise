// ============================================================
// Points Engine — Centralized reward logic for LoopWise
//
// ALL point calculations go through this module.
// No scattered point logic in page components.
// ============================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { POINT_VALUES, DAILY_OBSERVATION_LIMIT } from '../types'
import type {
  PointReason,
  PointsLogEntry,
  StreakInfo,
  Observation,
  ReductionAction,
  ActionFeedback,
} from '../types'

// ── Helpers ──────────────────────────────────────────────

function today(): string {
  // Use local date for consistency with user's timezone
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// ── Core: Award Points (idempotent) ──────────────────────

/**
 * Award points for a specific event. Uses unique constraint on
 * (user_id, reference_id, reason) to prevent double-awards.
 * Returns the number of points actually awarded (0 if already awarded).
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: PointReason,
  referenceId: string,
  referenceType: string
): Promise<number> {
  if (!isSupabaseConfigured()) {
    // Mock mode: just return the points
    return points
  }

  // Check if this event already awarded points (idempotency)
  const { data: existing } = await supabase
    .from('points_log')
    .select('id')
    .eq('user_id', userId)
    .eq('reference_id', referenceId)
    .eq('reason', reason)
    .limit(1)

  if (existing && existing.length > 0) {
    return 0 // Already awarded
  }

  // Insert the points log entry
  const { error: logError } = await supabase
    .from('points_log')
    .insert({
      id: generateId('pts'),
      user_id: userId,
      points,
      reason,
      reference_id: referenceId,
      reference_type: referenceType,
    })

  if (logError) {
    console.error('Failed to log points:', logError)
    return 0
  }

  // Update user's total points
  // Fetch current points and update
  const { data: user } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .single()

  if (user) {
    await supabase
      .from('users')
      .update({ points: user.points + points })
      .eq('id', userId)
  }

  return points
}

// ── Observation Reward ───────────────────────────────────

/**
 * Award points for a new observation.
 * Checks daily limit and idempotency.
 */
export async function rewardObservation(
  observation: Observation
): Promise<{ pointsAwarded: number; dailyLimitReached: boolean }> {
  const userId = observation.reporterId
  if (!userId) return { pointsAwarded: 0, dailyLimitReached: false }

  if (!isSupabaseConfigured()) {
    return { pointsAwarded: POINT_VALUES.verified_observation, dailyLimitReached: false }
  }

  // Check daily observation limit
  const todayStr = today()
  const { data: user } = await supabase
    .from('users')
    .select('daily_observation_count, daily_observation_date')
    .eq('id', userId)
    .single()

  if (user) {
    // Reset count if it's a new day
    if (user.daily_observation_date !== todayStr) {
      await supabase
        .from('users')
        .update({
          daily_observation_count: 1,
          daily_observation_date: todayStr,
        })
        .eq('id', userId)
    } else if (user.daily_observation_count >= DAILY_OBSERVATION_LIMIT) {
      // Daily limit reached — still store observation but no points
      return { pointsAwarded: 0, dailyLimitReached: true }
    } else {
      // Increment count
      await supabase
        .from('users')
        .update({
          daily_observation_count: user.daily_observation_count + 1,
        })
        .eq('id', userId)
    }
  }

  // Award points (idempotent — won't double-award if same observation ID)
  const points = await awardPoints(
    userId,
    POINT_VALUES.verified_observation,
    'verified_observation',
    observation.id,
    'observation'
  )

  return { pointsAwarded: points, dailyLimitReached: false }
}

// ── Daily Check-in ───────────────────────────────────────

/**
 * Record a "nothing to report" check-in for today.
 * Only one check-in per calendar day per student.
 */
export async function recordNothingToReportCheckin(
  userId: string
): Promise<{ success: boolean; alreadyCheckedIn: boolean; pointsAwarded: number }> {
  if (!isSupabaseConfigured()) {
    return { success: true, alreadyCheckedIn: false, pointsAwarded: POINT_VALUES.daily_checkin }
  }

  const todayStr = today()

  // Check if already checked in today
  const { data: existing } = await supabase
    .from('daily_checkins')
    .select('id, checkin_type')
    .eq('user_id', userId)
    .eq('checkin_date', todayStr)
    .limit(1)

  if (existing && existing.length > 0) {
    return { success: true, alreadyCheckedIn: true, pointsAwarded: 0 }
  }

  // Record the check-in
  const checkinId = generateId('chk')
  const { error } = await supabase
    .from('daily_checkins')
    .insert({
      id: checkinId,
      user_id: userId,
      checkin_type: 'nothing_to_report',
      checkin_date: todayStr,
    })

  if (error) {
    console.error('Failed to record check-in:', error)
    return { success: false, alreadyCheckedIn: false, pointsAwarded: 0 }
  }

  // Award check-in points
  const points = await awardPoints(
    userId,
    POINT_VALUES.daily_checkin,
    'daily_checkin',
    checkinId,
    'checkin'
  )

  return { success: true, alreadyCheckedIn: false, pointsAwarded: points }
}

/**
 * Record observation-based participation for today.
 * Called after a valid observation is created.
 */
export async function recordObservationCheckin(
  userId: string,
  observationId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return

  const todayStr = today()

  // Check if already checked in today
  const { data: existing } = await supabase
    .from('daily_checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('checkin_date', todayStr)
    .limit(1)

  if (existing && existing.length > 0) return // Already checked in

  // Record observation as today's check-in
  await supabase
    .from('daily_checkins')
    .insert({
      id: generateId('chk'),
      user_id: userId,
      checkin_type: 'observation',
      checkin_date: todayStr,
      observation_id: observationId,
    })
}

// ── Streak Calculation ───────────────────────────────────

/**
 * Calculate current streak, longest streak, and bonus eligibility.
 * Streak = consecutive calendar days with a check-in.
 * After 7 days, bonus is awarded and streak resets.
 */
export async function getStreakInfo(userId: string): Promise<StreakInfo> {
  if (!isSupabaseConfigured()) {
    return {
      currentStreak: 3,
      longestStreak: 5,
      todayCheckedIn: false,
      daysUntilBonus: 4,
    }
  }

  // Fetch all check-ins for this user, ordered by date descending
  const { data: checkins } = await supabase
    .from('daily_checkins')
    .select('checkin_date')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: false })

  if (!checkins || checkins.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      todayCheckedIn: false,
      daysUntilBonus: 7,
    }
  }

  const todayStr = today()
  const dates = checkins.map((c) => c.checkin_date)

  // Check if today is checked in
  const todayCheckedIn = dates[0] === todayStr

  // Calculate current streak (consecutive days backwards from today/yesterday)
  let currentStreak = 0
  const startDate = todayCheckedIn ? new Date(todayStr) : new Date(todayStr)
  if (!todayCheckedIn) {
    // If not checked in today, start from yesterday
    startDate.setDate(startDate.getDate() - 1)
  }

  for (let i = 0; i < 365; i++) {
    const checkDate = new Date(startDate)
    checkDate.setDate(checkDate.getDate() - i)
    const dateStr = checkDate.toISOString().split('T')[0]

    if (dates.includes(dateStr)) {
      currentStreak++
    } else {
      break
    }
  }

  // Calculate longest streak
  let longestStreak = 0
  let tempStreak = 0
  const sortedDates = [...dates].sort()

  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      tempStreak = 1
    } else {
      const prev = new Date(sortedDates[i - 1])
      const curr = new Date(sortedDates[i])
      const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)

      if (diffDays === 1) {
        tempStreak++
      } else {
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)
  }

  // Days until next bonus (after 7-day cycle resets)
  const daysUntilBonus = currentStreak >= 7 ? 0 : 7 - currentStreak

  return {
    currentStreak: Math.min(currentStreak, 7), // Cap display at 7
    longestStreak,
    todayCheckedIn,
    daysUntilBonus,
  }
}

/**
 * Check and award weekly streak bonus if student has 7 consecutive days.
 * Returns bonus points awarded (0 if no bonus yet).
 */
export async function checkAndAwardStreakBonus(userId: string): Promise<number> {
  const streakInfo = await getStreakInfo(userId)

  if (streakInfo.currentStreak < 7) return 0

  // Award streak bonus (idempotent — uses today's date as reference)
  const bonusRef = `streak-${today()}`
  const points = await awardPoints(
    userId,
    POINT_VALUES.weekly_streak_bonus,
    'weekly_streak_bonus',
    bonusRef,
    'streak'
  )

  return points
}

// ── Suggestion Adoption Reward ───────────────────────────

/**
 * Award points when Eco Club adopts a student's suggestion.
 * Only awards once per suggestion (idempotent).
 */
export async function rewardSuggestionAdoption(
  suggestionId: string,
  studentUserId: string
): Promise<number> {
  return awardPoints(
    studentUserId,
    POINT_VALUES.suggestion_adopted,
    'suggestion_adopted',
    suggestionId,
    'suggestion'
  )
}

// ── Feedback Reward + Before/After Bonus ─────────────────

/**
 * Award points for feedback submission.
 * Also checks for Before → After bonus eligibility.
 */
export async function rewardFeedback(
  feedback: ActionFeedback,
  allObservations: Observation[],
  allActions: ReductionAction[]
): Promise<{ feedbackPoints: number; beforeAfterPoints: number }> {
  const userId = feedback.reporterId
  if (!userId) return { feedbackPoints: 0, beforeAfterPoints: 0 }

  // Award feedback points (idempotent — one reward per student per action)
  // Uses student+action as reference so second feedback on same action gets no points
  const feedbackRef = `fb-${userId}-${feedback.actionId}`
  const feedbackPoints = await awardPoints(
    userId,
    POINT_VALUES.feedback_submitted,
    'feedback_submitted',
    feedbackRef,
    'feedback'
  )

  // Check Before → After eligibility
  const action = allActions.find((a) => a.id === feedback.actionId)
  if (!action || !action.linkedHotspotCategory || !action.linkedHotspotLocation) {
    return { feedbackPoints, beforeAfterPoints: 0 }
  }

  // Check if student had a matching observation BEFORE the action started
  const actionStartDate = action.startDate
  if (!actionStartDate) return { feedbackPoints, beforeAfterPoints: 0 }

  const hasBeforeObservation = allObservations.some(
    (obs) =>
      obs.reporterId === userId &&
      obs.plasticCategory === action.linkedHotspotCategory &&
      obs.location === action.linkedHotspotLocation &&
      obs.date < actionStartDate + 'T00:00:00Z' // Observation was before action started
  )

  if (!hasBeforeObservation) {
    return { feedbackPoints, beforeAfterPoints: 0 }
  }

  // Award before/after bonus (idempotent — one per student per action)
  const beforeAfterRef = `ba-${userId}-${feedback.actionId}`
  const beforeAfterPoints = await awardPoints(
    userId,
    POINT_VALUES.before_after_bonus,
    'before_after_bonus',
    beforeAfterRef,
    'feedback'
  )

  return { feedbackPoints, beforeAfterPoints }
}

// ── User Points & History ────────────────────────────────

/**
 * Get a student's total points from the users table.
 */
export async function getUserPoints(userId: string): Promise<number> {
  if (!isSupabaseConfigured()) {
    return 80 // Mock: sum of seed observations
  }

  const { data } = await supabase
    .from('users')
    .select('points')
    .eq('id', userId)
    .single()

  return data?.points ?? 0
}

/**
 * Get a student's recent point award history.
 */
export async function getUserPointsHistory(
  userId: string,
  limit = 10
): Promise<PointsLogEntry[]> {
  if (!isSupabaseConfigured()) {
    return []
  }

  const { data } = await supabase
    .from('points_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data.map((row) => ({
    id: row.id,
    userId: row.user_id,
    points: row.points,
    reason: row.reason as PointsLogEntry['reason'],
    referenceId: row.reference_id,
    referenceType: row.reference_type as PointsLogEntry['referenceType'],
    createdAt: row.created_at,
  }))
}

/**
 * Check if student already submitted feedback for this action.
 */
export async function hasStudentFeedbackForAction(
  userId: string,
  actionId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false

  const { data } = await supabase
    .from('action_feedback')
    .select('id')
    .eq('reporter_id', userId)
    .eq('action_id', actionId)
    .limit(1)

  return (data?.length ?? 0) > 0
}
