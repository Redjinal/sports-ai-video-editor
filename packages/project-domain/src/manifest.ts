// Portable project manifest (project-format.md §4–5).
// project.json is the authoritative, portable source of truth. schemaVersion is an
// integer; unknown future fields are preserved where safe (forward compatibility).
import { z } from "zod";
import { sequenceSchema } from "@sve/timeline-domain";
import { projectAssetSchema } from "./asset";

export const CURRENT_SCHEMA_VERSION = 1 as const;
export const MINIMUM_READER_VERSION = "0.1.0" as const;

export const projectManifestSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    projectId: z.string().min(1),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    projectType: z.enum(["general", "basketball"]),
    platformCreatedOn: z.enum(["windows", "android"]),
    settings: z.record(z.unknown()).default({}),
    assets: z.array(projectAssetSchema).default([]),
    // Phase 1 may embed sequences inline; schema permits later split to files (§7).
    sequences: z.array(sequenceSchema).default([]),
    basketballContexts: z.array(z.unknown()).default([]),
    brandKits: z.array(z.unknown()).default([]),
    templates: z.array(z.unknown()).default([]),
    proposalSets: z.array(z.unknown()).default([]),
    activeMasterSequenceId: z.string().nullable().default(null),
    compatibility: z
      .object({ minimumReaderVersion: z.string() })
      .default({ minimumReaderVersion: MINIMUM_READER_VERSION }),
  })
  // Preserve unknown fields written by newer readers (project-format.md §5).
  .passthrough();

export type ProjectManifest = z.infer<typeof projectManifestSchema>;

/** Validate an untrusted manifest payload (e.g. read from disk) into a typed manifest. */
export function parseManifest(input: unknown): ProjectManifest {
  const manifest = projectManifestSchema.parse(input);
  if (manifest.schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Project schemaVersion ${manifest.schemaVersion} is newer than this reader supports (${CURRENT_SCHEMA_VERSION})`,
    );
  }
  return manifest;
}

/** Create an empty general-project manifest with one empty master sequence settings. */
export function createEmptyManifest(params: {
  projectId: string;
  name: string;
  now: string;
  platform?: "windows" | "android";
  projectType?: "general" | "basketball";
}): ProjectManifest {
  return projectManifestSchema.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    projectId: params.projectId,
    name: params.name,
    createdAt: params.now,
    updatedAt: params.now,
    projectType: params.projectType ?? "general",
    platformCreatedOn: params.platform ?? "windows",
  });
}
