// ============================================================
// Perceptual Hash (DCT-based pHash) — Browser-side
//
// Computes a 64-bit perceptual hash using the Discrete Cosine
// Transform (DCT-II). This is the standard pHash algorithm
// used for image similarity detection.
//
// NOT AI — this is pure image signal processing.
// The hash captures low-frequency structure of an image,
// making it robust to brightness, contrast, and minor
// transformations.
//
// Algorithm:
//   1. Resize to 32×32 grayscale
//   2. Apply 2D DCT-II
//   3. Take top-left 8×8 corner (low-frequency coefficients)
//   4. Compute median of 64 values
//   5. Hash: 1 if coefficient > median, 0 otherwise
//   6. Return 16-char hex string (64 bits)
//
// Limitations (documented for transparency):
//   - Not robust to rotation > 15°
//   - Not robust to significant cropping (>50%)
//   - Different physical objects from same angle may match
//   - Same object from very different angles may not match
//   - This detects SIMILAR IMAGES, not necessarily same objects
// ============================================================

const HASH_SIZE = 8   // 8×8 = 64 bits
const DCT_SIZE = 32   // Resize to 32×32 before DCT

/**
 * Compute a DCT-based perceptual hash from an image File.
 * Returns a hex string of length 16 (64 bits).
 *
 * This is a browser-side operation — no server calls needed.
 */
export async function computePHash(file: File): Promise<string> {
  const img = await loadImage(file)
  const pixels = getGrayscalePixels(img, DCT_SIZE, DCT_SIZE)

  // Apply 2D DCT-II
  const dct = computeDCT2D(pixels, DCT_SIZE)

  // Take top-left HASH_SIZE × HASH_SIZE (low-frequency coefficients)
  // Skip the DC component (dct[0][0]) which is just the average
  const lowFreq: number[] = []
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      lowFreq.push(dct[y * DCT_SIZE + x])
    }
  }

  // Compute median
  const sorted = [...lowFreq].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]

  // Build 64-bit hash: 1 if above median, 0 if below
  let hash = 0n
  for (let i = 0; i < lowFreq.length; i++) {
    if (lowFreq[i] > median) {
      hash |= 1n << BigInt(i)
    }
  }

  return hash.toString(16).padStart(16, '0')
}

/**
 * Compute hamming distance between two hex hash strings.
 * Each hex char = 4 bits, so distance is out of totalBits.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length)
  let distance = 0
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    distance += popcount(xor)
  }
  return distance
}

/**
 * Check if two hashes are similar (distance ≤ threshold).
 * For DCT pHash: threshold of 10 means ≤10 different bits
 * out of 64 (~84% similarity). This is the standard threshold
 * for DCT-based perceptual hashing.
 */
export function isSimilarPHash(a: string, b: string, threshold = 10): boolean {
  return hammingDistance(a, b) <= threshold
}

/**
 * Convert a hash distance to a similarity percentage (0–100).
 */
export function hashSimilarityPercent(a: string, b: string): number {
  const dist = hammingDistance(a, b)
  const maxBits = a.length * 4 // Each hex char = 4 bits
  return Math.round(((maxBits - dist) / maxBits) * 100)
}

// ── Internal helpers ──────────────────────────────────────

function popcount(n: number): number {
  let count = 0
  while (n > 0) {
    count += n & 1
    n >>= 1
  }
  return count
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(img.src)
      resolve(img)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function getGrayscalePixels(
  img: HTMLImageElement,
  width: number,
  height: number
): number[] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const pixels: number[] = []
  for (let i = 0; i < data.length; i += 4) {
    // ITU-R BT.601 luma coefficients
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    pixels.push(gray)
  }
  return pixels
}

/**
 * Compute 2D DCT-II on a flattened array of size N×N.
 * Returns a flattened array of DCT coefficients.
 *
 * This is the standard DCT-II formula used in JPEG compression.
 * It transforms spatial pixel data into frequency-domain coefficients.
 * Low frequencies (top-left) capture the overall structure;
 * high frequencies (bottom-right) capture fine detail.
 */
function computeDCT2D(pixels: number[], N: number): number[] {
  const result = new Array(N * N).fill(0)

  for (let u = 0; u < N; u++) {
    for (let v = 0; v < N; v++) {
      let sum = 0
      for (let x = 0; x < N; x++) {
        for (let y = 0; y < N; y++) {
          sum += pixels[y * N + x] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N))
        }
      }

      // Apply normalization factors
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1
      result[v * N + u] = sum * cu * cv * 0.25
    }
  }

  return result
}
