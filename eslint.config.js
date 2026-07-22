// Flat ESLint config.
// Focus: correctness + dependency-boundary enforcement (structure.md §7), not personal style.
// Formatting is owned by Prettier and deliberately not linted here.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Imports that platform-neutral domain packages must never reach for.
 * Native/UI/provider details belong only in adapters and apps.
 */
const FORBIDDEN_IN_DOMAINS = [
  { name: "react", message: "Domain packages must stay UI-agnostic (structure.md §7)." },
  { name: "react-dom", message: "Domain packages must stay UI-agnostic (structure.md §7)." },
  {
    name: "better-sqlite3",
    message: "Domains use portable state; SQLite lives in persistence adapters only.",
  },
];

const FORBIDDEN_PATTERNS_IN_DOMAINS = [
  {
    group: ["@tauri-apps/*"],
    message: "Domains must not depend on the Tauri shell (structure.md §7).",
  },
  {
    group: ["fluent-ffmpeg", "@ffmpeg/*", "*media3*"],
    message: "FFmpeg/Media3 details belong in native media adapters, not domains.",
  },
  {
    group: ["openai", "@anthropic-ai/*", "@google-cloud/*"],
    message: "Provider SDKs live behind AI/connector adapters, not in domains.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/target/**",
      "**/node_modules/**",
      "**/*.config.js",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Node-run developer tooling scripts.
    files: ["tools/**/*.mjs", "tools/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
  {
    // Dependency-boundary guard for platform-neutral domains + contracts.
    files: [
      "packages/timeline-domain/**/*.ts",
      "packages/project-domain/**/*.ts",
      "packages/media-contracts/**/*.ts",
      "packages/application-services/**/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: FORBIDDEN_IN_DOMAINS, patterns: FORBIDDEN_PATTERNS_IN_DOMAINS },
      ],
    },
  },
);
