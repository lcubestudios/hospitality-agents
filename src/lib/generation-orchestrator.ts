/**
 * Generation Orchestrator
 *
 * Provides a framework for sequential, composable generation steps with hooks for
 * future approval flows, logging, and error recovery.
 *
 * The orchestrator chains steps together, passing context through the pipeline.
 * Each step receives the accumulated context from previous steps and may enhance it.
 * Callbacks allow introspection and intervention at step boundaries.
 */

import { DirectorBrief, VisualStyle } from '@/app/api/campaigns/[id]/generate/route'

/**
 * Resolved visual scene from Vision analysis (Director's Brief).
 * May include additional fields from image/video generation pipelines.
 */
export interface ResolvedScene {
  hero_label: string
  dish_shape: 'tall' | 'wide'
  camera_angle: string
  background_subject: string
  [key: string]: unknown
}

/**
 * Generated asset from image or video pipeline.
 */
export interface GeneratedAsset {
  asset_url: string
  asset?: {
    id: string
    asset_url: string
  }
  asset_type?: 'image' | 'video'
  metadata?: Record<string, unknown>
}

/**
 * Subject lock — user-specified anchor for Vision analysis.
 */
export interface SubjectLock {
  form: string // e.g., "single pasta portion"
  tier?: 'tier_1' | 'tier_2' | 'tier_3'
}

/**
 * Directive — template or composition intent passed to generation.
 */
export interface DirectiveObject {
  intent?: string
  template?: string
}

/**
 * Orchestration context passed through the pipeline.
 * Accumulated as steps execute, allowing later steps to reference earlier outputs.
 */
export interface OrchestrationContext {
  campaignId: string
  brandId: string
  postTopic?: string
  visualStyle?: VisualStyle
  subjectLock?: SubjectLock
  directive?: DirectiveObject
  resolvedScene?: ResolvedScene
  briefFromVision?: DirectorBrief
  assets?: GeneratedAsset[]
  schedule?: Array<{ date: string; platform: string; content_brief: string }>
  visual_language?: { color_story: string; lighting_character: string; mood: string }
  metadata?: Record<string, unknown>
}

/**
 * Step name discriminator for routing and debugging.
 */
export type StepName = 'vision' | 'strategy' | 'generation' | 'upload'

/**
 * Single orchestration step.
 * Execute function receives context and returns enhanced context.
 * Optional onError handler for per-step recovery.
 */
export interface OrchestrationStep {
  name: StepName
  execute: (ctx: OrchestrationContext) => Promise<OrchestrationContext>
  onError?: (error: Error, ctx: OrchestrationContext) => Promise<OrchestrationContext | void>
}

/**
 * Callbacks for orchestration lifecycle.
 * Before/after hooks fire at step boundaries.
 * onStepError fires if a step fails (after onError handler, if any).
 */
export interface OrchestrationCallback {
  beforeStep?: (step: StepName, ctx: OrchestrationContext) => Promise<void>
  afterStep?: (step: StepName, ctx: OrchestrationContext) => Promise<void>
  onStepError?: (step: StepName, error: Error, ctx: OrchestrationContext) => Promise<void>
}

/**
 * Orchestrate a sequence of generation steps with callback hooks.
 *
 * Executes each step in order, passing context through the chain.
 * If a step throws:
 *   1. Call step.onError (if defined) for per-step recovery
 *   2. Call callbacks.onStepError (if defined) for global error handling
 *   3. Re-throw error (step failure halts pipeline)
 *
 * @param steps Array of orchestration steps to execute sequentially
 * @param initialContext Initial context (campaignId, brandId, etc.)
 * @param callbacks Optional lifecycle callbacks for observability
 * @returns Final context with all accumulated outputs
 */
export async function orchestrate(
  steps: OrchestrationStep[],
  initialContext: OrchestrationContext,
  callbacks?: OrchestrationCallback,
): Promise<OrchestrationContext> {
  let context = initialContext

  for (const step of steps) {
    try {
      // Before hook
      if (callbacks?.beforeStep) {
        await callbacks.beforeStep(step.name, context)
      }

      // Execute step
      const nextContext = await step.execute(context)
      context = nextContext ?? context

      // After hook
      if (callbacks?.afterStep) {
        await callbacks.afterStep(step.name, context)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))

      // Step-level error recovery
      if (step.onError) {
        try {
          const recovered = await step.onError(err, context)
          if (recovered) {
            context = recovered
            continue
          }
        } catch (recoveryErr) {
          console.error(
            `Step ${step.name} recovery failed:`,
            recoveryErr instanceof Error ? recoveryErr.message : String(recoveryErr),
          )
        }
      }

      // Global error callback
      if (callbacks?.onStepError) {
        try {
          await callbacks.onStepError(step.name, err, context)
        } catch (callbackErr) {
          console.error(
            `Callback onStepError for ${step.name} failed:`,
            callbackErr instanceof Error ? callbackErr.message : String(callbackErr),
          )
        }
      }

      // Re-throw to halt pipeline
      throw err
    }
  }

  return context
}
