// Adapter ports (technical-architecture.md §8). Application services depend on these
// interfaces; platform adapters (Rust/FFmpeg, Media3) implement them. Domains never
// import the adapters directly.
import type {
  InspectMediaRequestV1,
  InspectMediaResultV1,
  GenerateProxyRequestV1,
  ProxyResultV1,
  RenderPlan,
  OutputValidationResult,
  ExportJobProgress,
} from "@sve/media-contracts";

export interface MediaInspector {
  inspect(request: InspectMediaRequestV1): Promise<InspectMediaResultV1>;
}

export interface ProxyGenerator {
  generate(request: GenerateProxyRequestV1): Promise<ProxyResultV1>;
}

export interface SequenceExporter {
  /** Render + encode + validate. Resolves only after output validation completes. */
  export(args: {
    plan: RenderPlan;
    outputPath: string;
    jobId: string;
    signal?: AbortSignal;
    onProgress?: (p: ExportJobProgress) => void;
  }): Promise<OutputValidationResult>;
}
