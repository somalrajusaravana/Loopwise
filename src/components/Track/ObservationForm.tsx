import { useState, useEffect, useRef } from 'react'
import type { PlasticCategory, CampusLocation, Observation } from '../../types'
import { createObservation, uploadPhoto } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { rewardObservation, recordObservationCheckin, checkAndAwardStreakBonus } from '../../services/points-engine'
import { computePHash } from '../../utils/phash'
import { assessContributionAsync } from '../../utils/contribution-guard'
import { classifyImage, type AIClassificationResult } from '../../services/ai-classifier'

const PLASTIC_CATEGORIES: { value: PlasticCategory; label: string }[] = [
  { value: 'straws', label: 'Straws' },
  { value: 'cups-lids', label: 'Cups & Lids' },
  { value: 'utensils', label: 'Utensils' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'food-packaging', label: 'Food Packaging' },
  { value: 'bags', label: 'Bags' },
  { value: 'containers', label: 'Containers' },
  { value: 'other', label: 'Other' },
]

const CAMPUS_LOCATIONS: CampusLocation[] = [
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
]

interface Props {
  onSubmit: (observation: Observation) => void
}

export default function ObservationForm({ onSubmit }: Props) {
  const { appUser } = useAuth()
  const userId = appUser?.id ?? ''
  const [category, setCategory] = useState<PlasticCategory | ''>('')
  const [location, setLocation] = useState<CampusLocation | ''>('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // AI classification state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AIClassificationResult | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiCategorySelected, setAiCategorySelected] = useState(true)
  const aiRequestRef = useRef(0)

  // Run AI classification when a photo is selected
  useEffect(() => {
    if (!photoFile) {
      setAiResult(null)
      setAiError(null)
      setAiLoading(false)
      return
    }

    // Reset previous AI result
    setAiResult(null)
    setAiError(null)
    setAiLoading(true)
    setAiCategorySelected(true)

    // Increment request ID to cancel stale results
    const requestId = ++aiRequestRef.current

    classifyImage(photoFile).then((result) => {
      // Only apply if this is still the latest request
      if (requestId !== aiRequestRef.current) return

      if (result) {
        setAiResult(result)
        // Pre-fill the category with the AI suggestion
        setCategory(result.category)
        setAiCategorySelected(true)
      } else {
        setAiError('AI classification unavailable — please select the category manually.')
      }
      setAiLoading(false)
    })
  }, [photoFile])

  // Photo is required; category, location are required; description is optional
  const canSubmit = !!photoFile && !!category && !!location

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)

    try {
      // 1. Upload photo to Supabase Storage (or blob URL in mock mode)
      let photoStoragePath: string | undefined
      if (photoFile) {
        const uploadedPath = await uploadPhoto('observation-photos', photoFile, userId)
        if (uploadedPath) {
          photoStoragePath = uploadedPath
        }
      }

      // 2. Compute perceptual hash for duplicate detection
      let photoPhash: string | undefined
      let flaggedForReview = false
      if (photoFile) {
        try {
          photoPhash = await computePHash(photoFile)
          // Run contribution guard: check for near-duplicate photos
          const assessment = await assessContributionAsync(photoPhash)
          if (assessment.duplicateFlag) {
            flaggedForReview = true
          }
        } catch {
          // pHash computation failed — continue without it
          // (non-critical; observation still valid)
        }
      }

      // 3. Create observation via API (with pHash, review flag, and AI classification)
      const newObservation = await createObservation({
        plasticCategory: category as PlasticCategory,
        location: location as CampusLocation,
        description: description.trim() || undefined,
        photoStoragePath,
        photoPhash,
        flaggedForReview,
        pointsAwarded: flaggedForReview ? 0 : undefined,
        userId,
        aiCategory: aiResult?.category,
        aiConfidence: aiResult?.confidence,
      })

      if (newObservation) {
        onSubmit(newObservation)

        // 4. Award points and record daily participation
        // Flagged (duplicate/suspicious) observations do NOT earn points
        let pointsAwarded = 0
        let dailyLimitReached = false
        if (flaggedForReview) {
          // No points for flagged submissions — still record check-in for streak
          await recordObservationCheckin(newObservation.reporterId, newObservation.id)
        } else {
          const result = await rewardObservation(newObservation)
          pointsAwarded = result.pointsAwarded
          dailyLimitReached = result.dailyLimitReached
          await recordObservationCheckin(newObservation.reporterId, newObservation.id)
          await checkAndAwardStreakBonus(newObservation.reporterId)
        }

        // Build success message
        let msg = 'Observation submitted successfully!'
        if (dailyLimitReached) {
          msg += ' Daily point limit reached — observation saved but no additional points.'
        } else if (flaggedForReview) {
          msg += ' ⚠ Your submission was flagged for review (possible duplicate photo). Saved but no points awarded.'
        } else if (pointsAwarded > 0) {
          msg += ` +${pointsAwarded} points`
        } else {
          msg += ' Observation saved.'
        }

        setSuccess(true)
        setSuccessMessage(msg)

        // Reset form
        setCategory('')
        setLocation('')
        setDescription('')
        setPhotoFile(null)
        setAiResult(null)
        setAiError(null)
        setAiLoading(false)

        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError('Failed to submit observation. Please try again.')
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Success message */}
      {success && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 text-sm text-brand-700">
          ✓ {successMessage}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        ℹ Observations are community-reported data, not exact measurements of plastic consumption.
      </div>

      {/* AI Classification Status */}
      {aiLoading && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 text-sm text-purple-700 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          🤖 Analyzing image with AI…
        </div>
      )}
      {aiResult && !aiLoading && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm">
          <span className="text-emerald-700 font-medium">
            🤖 AI detected: {PLASTIC_CATEGORIES.find(c => c.value === aiResult.category)?.label ?? aiResult.category}
          </span>
          <span className="text-emerald-500 ml-1">
            ({Math.round(aiResult.confidence * 100)}% confidence)
          </span>
          <p className="text-xs text-emerald-500 mt-1">
            This is a suggestion — you can change the category below if needed.
          </p>
        </div>
      )}
      {aiError && !aiLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          {aiError}
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          Plastic Item / Category *
          {aiResult && !aiLoading && (
            <span className="text-xs font-normal text-emerald-600 ml-1">(AI-suggested)</span>
          )}
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as PlasticCategory)
            // If user manually changes away from AI suggestion, note it
            if (aiResult && e.target.value !== aiResult.category) {
              setAiCategorySelected(false)
            } else {
              setAiCategorySelected(true)
            }
          }}
          className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          required
        >
          <option value="">Select a category…</option>
          {PLASTIC_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
        {aiResult && !aiCategorySelected && !aiLoading && (
          <p className="text-xs text-amber-600 mt-1">
            ⚠ You changed the category from the AI suggestion ({PLASTIC_CATEGORIES.find(c => c.value === aiResult.category)?.label}).
          </p>
        )}
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          Campus Location *
        </label>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value as CampusLocation)}
          className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
          required
        >
          <option value="">Select a location…</option>
          {CAMPUS_LOCATIONS.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      {/* Photo Upload — REQUIRED */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          Photo Evidence *
        </label>
        <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          photoFile ? 'border-brand-400 bg-brand-50' : 'border-surface-300 hover:border-brand-400'
        }`}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="photo-upload"
          />
          <label htmlFor="photo-upload" className="cursor-pointer">
            {photoFile ? (
              <div>
                <p className="text-sm text-brand-600 font-medium">
                  📷 {photoFile.name}
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  Click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-2xl text-surface-300">📷</p>
                <p className="text-sm text-surface-500 mt-2">
                  Click to upload a photo
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  Required — the photo is primary evidence for your observation
                </p>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Description — OPTIONAL */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          Description <span className="text-surface-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Add any additional context about what you observed…"
          className="w-full border border-surface-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
        />
        {description.length > 0 && (
          <p className="text-xs text-surface-400 mt-1">
            {description.length}/500 characters
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="w-full bg-brand-600 text-white font-medium py-2.5 rounded-lg text-sm hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'Submitting…' : 'Submit Observation'}
      </button>
    </form>
  )
}
