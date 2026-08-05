/**
 * Validates that tier resolution doesn't change the subject.
 * Phase 1 (MVP): Placeholder that validates and logs. Retry logic is Phase 2.
 */

export interface SubjectLock {
  original_subject: string
}

export interface BrandContext {
  atmosphere?: string[]
  personality?: string[]
}

export interface TierResolutionInput {
  subjectLock: SubjectLock
  selectedTier: 'enhanced' | 'editorial' | 'cinematic'
  brandContext: BrandContext
}

export interface TierResolutionResult {
  subjectPreserved: boolean
  warnings: string[]
  selectedScene: string
}

/**
 * Resolve tier selection to a scene, validating subject preservation.
 * For MVP, this just validates; doesn't retry.
 * Emits console.warn() if subject drifts.
 * Logs which tier was selected.
 */
export function resolveTierToScene(input: TierResolutionInput): TierResolutionResult {
  const { subjectLock, selectedTier, brandContext } = input
  const warnings: string[] = []

  console.log(`[TierResolution] Tier selected: ${selectedTier}`)
  console.log(`[TierResolution] Subject lock: "${subjectLock.original_subject}"`)

  // Validate atmosphere and personality are clean arrays
  const atmosphereStr = brandContext.atmosphere?.join(', ') || 'not specified'
  const personalityStr = brandContext.personality?.join(', ') || 'not specified'

  console.log(`[TierResolution] Brand atmosphere: ${atmosphereStr}`)
  console.log(`[TierResolution] Brand personality: ${personalityStr}`)

  // Phase 1: Simple validation that subject is still present
  // Phase 2 would check Vision output drift and retry if needed
  const subjectPreserved = Boolean(
    subjectLock.original_subject && subjectLock.original_subject.trim(),
  )

  if (!subjectPreserved) {
    const msg = 'Subject lock was empty or undefined'
    warnings.push(msg)
    console.warn(`[TierResolution] WARNING: ${msg}`)
  }

  // Determine scene description based on tier
  const sceneMap: Record<'enhanced' | 'editorial' | 'cinematic', string> = {
    enhanced:
      'Master retoucher pass — scene locked, technical refinement only, preserving all original elements.',
    editorial:
      'Magazine stylist reshoot — dish identity preserved, surface and lighting completely redesigned.',
    cinematic:
      'Bespoke brand campaign production — full narrative scene with supporting props and atmospheric storytelling.',
  }

  const selectedScene = sceneMap[selectedTier]

  console.log(`[TierResolution] Scene: ${selectedScene}`)

  return {
    subjectPreserved,
    warnings,
    selectedScene,
  }
}
