// @sve/caption-domain — transcript, transcript-driven selection, and captions (M6).
//
// Platform-neutral: pure TypeScript + zod only. No AI provider is selected or referenced here —
// transcription/translation are provider-neutral interfaces/proposals for a later, separately
// approved adapter to implement.
export * from "./errors";
export * from "./timecode";
export * from "./transcript";
export * from "./transcript-operations";
export * from "./transcript-search";
export * from "./transcript-selection";
export * from "./caption";
export * from "./caption-generation";
export * from "./srt";
export * from "./vtt";
export * from "./translation";
export * from "./burn-in";
