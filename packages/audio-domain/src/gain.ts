// Decibel <-> linear-gain conversion (audio-domain.md — M6 mixer).
// Pure math only; no I/O. 0 dB == unity gain (1.0). Silence is represented as
// -Infinity dB / 0 linear gain, never as a magic sentinel number.

/** Convert a decibel value to a linear amplitude multiplier. -Infinity dB -> 0 gain. */
export function dbToGain(db: number): number {
  if (db === Number.NEGATIVE_INFINITY) return 0;
  return Math.pow(10, db / 20);
}

/** Convert a linear amplitude multiplier to decibels. Non-positive gain -> -Infinity dB. */
export function gainToDb(gain: number): number {
  if (gain <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(gain);
}
