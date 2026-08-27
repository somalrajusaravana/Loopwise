// ============================================================
// Contribution Guard — Duplicate / Suspicious Detection
//
// Genuine observations are never blocked. This module only
// flags possible duplicates for review or reduced rewards.
// ============================================================

import type { Observation } from '../types'
import { checkPHashDuplicate } from '../services/api'

// ── Perceptual Hash Similarity ──────────────────────────────

function computePhashSimilarity(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return 0

  let matchingBits = 0
  const totalBits = hash1.length * 4 // Each hex char = 4 bits

  for (let i = 0; i < hash1.length; i++) {
    const xor = parseInt(hash1[i], 16) ^ parseInt(hash2[i], 16)
    matchingBits += 4 - popcount(xor)
  }

  return matchingBits / totalBits
}

function popcount(n: number): number {
  let count = 0
  while (n > 0) {
    count += n & 1
    n >>= 1
  }
  return count
}

// ── Duplicate Detection ─────────────────────────────────────

export function checkForDuplicatePhotos(
  newPHash: string | undefined,
  existingObservations: Observation[]
): { isDuplicate: boolean; similarTo?: string; similarity: number } {
  if (!newPHash) return { isDuplicate: false, similarity: 0 }

  for (const obs of existingObservations) {
    if (!obs.pHash) continue
    const similarity = computePhashSimilarity(newPHash, obs.pHash)

    // 85%+ similarity triggers the duplicate flag
    if (similarity >= 0.85) {
      return {
        isDuplicate: true,
        similarTo: obs.id,
        similarity,
      }
    }
  }

  return { isDuplicate: false, similarity: 0 }
}

// ── Assessment ──────────────────────────────────────────────

export interface ContributionAssessment {
  duplicateFlag: boolean
  pointsMultiplier: number
}

export function assessContribution(
  _userId: string,
  newObservation: Partial<Observation>,
  existingObservations: Observation[]
): ContributionAssessment {
  // Check for similar photos via perceptual hashing
  const photoCheck = checkForDuplicatePhotos(
    newObservation.pHash,
    existingObservations
  )

  return {
    duplicateFlag: photoCheck.isDuplicate,
    pointsMultiplier: photoCheck.isDuplicate ? 0.5 : 1,
  }
}

// Async version for API-backed duplicate checking
export async function assessContributionAsync(
  newPHash: string | undefined
): Promise<ContributionAssessment> {
  if (!newPHash) {
    return { duplicateFlag: false, pointsMultiplier: 1 }
  }

  const isDuplicate = await checkPHashDuplicate(newPHash)
  return {
    duplicateFlag: isDuplicate,
    pointsMultiplier: isDuplicate ? 0.5 : 1,
  }
}
