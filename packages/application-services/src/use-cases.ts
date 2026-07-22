// Platform-neutral use cases (technical-architecture.md §10). Thin orchestration:
// validate input, invoke a domain command or an injected adapter, return a typed result.
import {
  validateRenderPlan,
  type InspectMediaRequestV1,
  type InspectMediaResultV1,
  type RenderPlan,
  type OutputValidationResult,
  type ExportJobProgress,
} from "@sve/media-contracts";
import {
  applyCommand,
  type Sequence,
  type TimelineCommand,
  type CommandContext,
} from "@sve/timeline-domain";
import type { MediaInspector, SequenceExporter } from "./ports";

export async function inspectMedia(
  inspector: MediaInspector,
  request: InspectMediaRequestV1,
): Promise<InspectMediaResultV1> {
  return inspector.inspect(request);
}

/**
 * Apply a validated timeline command, returning the next sequence and its inverse for
 * the undo stack. Errors propagate unchanged; a failed command never enters history.
 */
export function executeTimelineCommand(
  sequence: Sequence,
  command: TimelineCommand,
  context?: CommandContext,
): { sequence: Sequence; inverse: TimelineCommand } {
  return applyCommand(sequence, command, context);
}

export async function exportSequence(
  exporter: SequenceExporter,
  args: {
    plan: RenderPlan;
    outputPath: string;
    jobId: string;
    signal?: AbortSignal;
    onProgress?: (p: ExportJobProgress) => void;
  },
): Promise<OutputValidationResult> {
  // Reject an invalid plan before any encoder work (EXPORT_INVALID_PLAN).
  const plan = validateRenderPlan(args.plan);
  const result = await exporter.export({ ...args, plan });
  // Success is defined by validation, never by process completion (media-engine.md §18).
  return result;
}
