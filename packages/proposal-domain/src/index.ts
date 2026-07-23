// @sve/proposal-domain — platform-neutral AI-proposal lifecycle and social-sequence domain
// (M10). AI *proposes*, the user decides: proposals live in separate proposal sequences and are
// only ever applied there — accepting/rejecting/modifying a proposal never mutates the approved
// master sequence, its score, or its clock.
//
// THE AI PROVIDER IS UNRESOLVED: no concrete AI/LLM/vision provider is selected or imported
// anywhere in this package. `HighlightScorer` is an interface only; NL parsing and highlight
// detection are provider work, not modeled here.
export * from "./model";
export * from "./schemas";
export * from "./proposal-sequence";
export * from "./lifecycle";
export * from "./scoring";
export * from "./social";
