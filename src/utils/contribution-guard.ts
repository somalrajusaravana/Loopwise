import type { Observation } from '../types'

// ── Perceptual Hash (pHash) Duplicate Detection ──────────────

/**
 * Simulated perceptual hash comparison.
 *
 * In production, this would use a real pHash library (e.g., imglookup).
 * For Round 1, we use a simple string similarity check on stored hash strings.
 *
 * IMPORTANT: pHash is a *supporting signal*, not proof of fraud.
 * Similar hashes flag images for human review or reduced rewards.
 */
export function computePhashSimilarity(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 0

  // Simple hamming distance simulation (hex string comparison)
  let matches = 0
  const len = Math.min(hash1.length, hash2.length)
  for (let i = 0; i < len; i++) {
    if (hash1[i] === hash2[i]) matches++
  }
  return matches / Math.max(hash1.length, hash2.length)
}

const PHASH_SIMILARITY_THRESHOLD = 0.85 // 85%+ similarity → flag for review

export function checkForDuplicatePhotos(
  newObservation: Partial<Observation>,
  existingObservations: Observation[] = []
): { isDuplicate: boolean; similarTo?: string; similarity?: number } {
  if (!newObservation.pHash) return { isDuplicate: false }

  for (const obs of existingObservations) {
    if (!obs.pHash) continue
    if (obs.reporterId === newObservation.reporterId) continue // Skip own reports

    const similarity = computePhashSimilarity(newObservation.pHash, obs.pHash)
    if (similarity >= PHASH_SIMILARITY_THRESHOLD) {
      return {
        isDuplicate: true,
        similarTo: obs.id,
        similarity,
      }
    }
  }

  return { isDuplicate: false }
}

// ── Contribution Protection Summary ──────────────────────────

/**
 * Assess a new observation for suspicious patterns.
 * Always allows submission — only flags for review and reduces rewards if needed.
 * Genuine observations are never blocked.
 */
export function assessContribution(
  _userId: string,
  newObservation: Partial<Observation>,
  existingObservations: Observation[] = []
): {
  duplicateFlag: boolean
  pointsMultiplier: number
} {
  const dupCheck = checkForDuplicatePhotos(newObservation, existingObservations)

  return {
    duplicateFlag: dupCheck.isDuplicate,
    pointsMultiplier: dupCheck.isDuplicate ? 0.5 : 1.0,
  }
}
