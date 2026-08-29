// ============================================================
// AI Image Classifier — Supabase Edge Function Integration
//
// Calls the `classify-image` Edge Function which uses Google
// Gemini Vision to classify plastic waste images.
//
// IMPORTANT: The Gemini API key is stored in the Edge Function
// environment, NOT in the frontend. The frontend only calls
// the Supabase Edge Function via the anon key.
//
// This is NOT a fake classifier — it sends the actual image
// to Gemini Vision for real AI-based classification.
// ============================================================

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { PlasticCategory } from '../types'

// Valid categories that the AI response must map to
const VALID_CATEGORIES: PlasticCategory[] = [
  'straws', 'cups-lids', 'utensils', 'bottles',
  'food-packaging', 'bags', 'containers', 'other',
]

export interface AIClassificationResult {
  category: PlasticCategory
  confidence: number // 0–1
}

/**
 * Classify a plastic waste image using the Supabase Edge Function.
 *
 * The Edge Function:
 * 1. Receives JSON { imageBase64, mimeType }
 * 2. Sends the image to Google Gemini Vision API
 * 3. Returns a JSON response with { category, confidence }
 *
 * Returns null if classification fails (caller should proceed
 * without AI classification — it's a non-critical enhancement).
 */
export async function classifyImage(
  file: File
): Promise<AIClassificationResult | null> {
  if (!isSupabaseConfigured()) {
    // Mock mode: return a random plausible category for demo
    const mockCategories: PlasticCategory[] = [
      'bottles', 'cups-lids', 'bags', 'food-packaging',
    ]
    return {
      category: mockCategories[Math.floor(Math.random() * mockCategories.length)],
      confidence: 0.7 + Math.random() * 0.25,
    }
  }

  try {
    // Convert File to base64 — the Edge Function expects { imageBase64, mimeType }
    const imageBase64 = await fileToBase64(file)

    // Call the Supabase Edge Function with JSON body
    const { data, error } = await supabase.functions.invoke('classify-image', {
      body: { imageBase64, mimeType: file.type },
    })

    if (error) {
      console.error('AI classification Edge Function error:', error)
      return null
    }

    // Validate response structure
    if (!data || typeof data.category !== 'string' || typeof data.confidence !== 'number') {
      console.error('AI classification returned invalid response:', data)
      return null
    }

    // Map the AI's response to our valid categories
    const category = normalizeCategory(data.category)
    const confidence = Math.max(0, Math.min(1, data.confidence))

    return { category, confidence }
  } catch (err) {
    console.error('AI classification failed:', err)
    return null
  }
}

/**
 * Convert a File to a base64 data string (without the data-URL prefix).
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Strip the data:image/...;base64, prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Normalize the AI's predicted category string to match our
 * PlasticCategory type. Handles common variations the AI might
 * return (e.g., "plastic bottle" → "bottles").
 */
function normalizeCategory(raw: string): PlasticCategory {
  const lower = raw.toLowerCase().trim()

  // Direct match
  if (VALID_CATEGORIES.includes(lower as PlasticCategory)) {
    return lower as PlasticCategory
  }

  // Keyword matching for common AI responses
  if (lower.includes('bottle')) return 'bottles'
  if (lower.includes('cup') || lower.includes('lid') || lower.includes('cap')) return 'cups-lids'
  if (lower.includes('straw')) return 'straws'
  if (lower.includes('bag')) return 'bags'
  if (lower.includes('fork') || lower.includes('knife') || lower.includes('spoon') || lower.includes('utensil')) return 'utensils'
  if (lower.includes('container') || lower.includes('box') || lower.includes('styrofoam')) return 'containers'
  if (lower.includes('food') || lower.includes('packaging') || lower.includes('wrapper') || lower.includes('takeout')) return 'food-packaging'

  return 'other'
}
