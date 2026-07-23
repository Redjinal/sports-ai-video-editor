// Certification matrix: the promised platform x codec x resolution combinations for M12
// (media-engine.md §4 export matrix; roadmap.md M12 exit criteria: "Every promised
// platform/codec/resolution combination passes the certification matrix.").
import type { Platform } from "./capability-matrix";
import { CAPABILITY_MATRIX, PLATFORMS } from "./capability-matrix";
import type { Resolution, VideoCodec } from "./settings";

export interface Combo {
  platform: Platform;
  videoCodec: VideoCodec;
  resolution: Resolution;
}

function comboKey(combo: Combo): string {
  return `${combo.platform}:${combo.videoCodec}:${combo.resolution}`;
}

/**
 * The full set of platform x codec x resolution combinations promised for M12
 * (media-engine.md §4). Derived directly from the capability matrix so the "promise" and the
 * capability data can never drift apart.
 */
export const PROMISED_MATRIX: readonly Combo[] = PLATFORMS.flatMap((platform) => {
  const caps = CAPABILITY_MATRIX[platform];
  return caps.videoCodecs.flatMap((videoCodec) =>
    caps.resolutions.map((resolution): Combo => ({ platform, videoCodec, resolution })),
  );
});

export interface ComboResult {
  combo: Combo;
  ok: boolean;
}

export interface CertificationReport {
  complete: boolean;
  missing: Combo[];
  failed: Combo[];
}

/**
 * Check a set of validation results against the full promised matrix. `complete` is true only
 * when every promised combo has a matching result and that result passed — a missing combo
 * (never exercised) and a failed combo (exercised but invalid) are both release blockers and are
 * reported separately (roadmap.md M12 exit criteria).
 */
export function certify(results: readonly ComboResult[]): CertificationReport {
  const byKey = new Map<string, ComboResult>();
  for (const result of results) {
    byKey.set(comboKey(result.combo), result);
  }

  const missing: Combo[] = [];
  const failed: Combo[] = [];

  for (const combo of PROMISED_MATRIX) {
    const result = byKey.get(comboKey(combo));
    if (result === undefined) {
      missing.push(combo);
    } else if (!result.ok) {
      failed.push(combo);
    }
  }

  return { complete: missing.length === 0 && failed.length === 0, missing, failed };
}
