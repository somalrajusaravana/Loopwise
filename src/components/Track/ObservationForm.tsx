import { useState } from 'react'
import type { PlasticCategory, CampusLocation, Observation } from '../../types'
import { CURRENT_USER, MOCK_OBSERVATIONS } from '../../mock/data'
import { assessContribution } from '../../utils/contribution-guard'

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
  const [category, setCategory] = useState<PlasticCategory | ''>('')
  const [location, setLocation] = useState<CampusLocation | ''>('')
  const [description, setDescription] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Contribution protection check (duplicate detection only)
  const protection = assessContribution(
    CURRENT_USER.id,
    {},
    MOCK_OBSERVATIONS
  )

  // Photo is required; category, location are required; description is optional
  const canSubmit = !!photoFile && !!category && !!location

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)

    // Simulate API delay
    await new Promise((r) => setTimeout(r, 800))

    const newObservation: Observation = {
      id: `obs-${Date.now()}`,
      plasticCategory: category as PlasticCategory,
      location: location as CampusLocation,
      description: description.trim(),
      photoUrl: URL.createObjectURL(photoFile),
      date: new Date().toISOString(),
      reporterName: CURRENT_USER.name,
      reporterId: CURRENT_USER.id,
      flaggedForReview: protection.duplicateFlag,
      pointsAwarded: Math.round(10 * protection.pointsMultiplier),
    }

    onSubmit(newObservation)
    setIsSubmitting(false)
    setSuccess(true)

    // Reset form
    setCategory('')
    setLocation('')
    setDescription('')
    setPhotoFile(null)

    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Duplicate flag */}
      {protection.duplicateFlag && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
          ⚠ Similar evidence detected. This may be flagged for review. You&apos;ll still earn points (reduced).
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="bg-brand-50 border border-brand-200 rounded-lg px-4 py-3 text-sm text-brand-700">
          ✓ Observation submitted successfully! +{Math.round(10 * protection.pointsMultiplier)} points
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
        ℹ Observations are community-reported data, not exact measurements of plastic consumption.
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1.5">
          Plastic Item / Category *
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as PlasticCategory)}
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
