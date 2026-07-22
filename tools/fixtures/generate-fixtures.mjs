// Synthetic, legal media fixtures for the M1 vertical slice (testing-strategy.md §3-4).
// Everything is generated from FFmpeg's built-in sources — no copyrighted footage.
//
// Usage:
//   node tools/fixtures/generate-fixtures.mjs [--long]
//
// Produces:
//   fixtures/media/sync8s_1080p30_h264_aac.mp4   (F1/F2, 8s, committed)
//   fixtures/media/generated/vslice_600s_1080p30_h264_aac.mp4  (F3, 10 min, --long, gitignored)
//
// Requires ffmpeg + ffprobe on PATH.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mediaDir = join(root, "fixtures", "media");
const generatedDir = join(mediaDir, "generated");

/** Encode one certified-baseline H.264/AAC MP4 with a moving picture + continuous tone. */
function encode(outPath, seconds) {
  mkdirSync(dirname(outPath), { recursive: true });
  const args = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `testsrc2=size=1920x1080:rate=30:duration=${seconds}`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=440:sample_rate=48000:duration=${seconds}`,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-g",
    "60",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    outPath,
  ];
  const res = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`ffmpeg failed for ${outPath} (status ${res.status})`);
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

const long = process.argv.includes("--long");

const shortPath = join(mediaDir, "sync8s_1080p30_h264_aac.mp4");
encode(shortPath, 8);
const checksums = { [`fixtures/media/sync8s_1080p30_h264_aac.mp4`]: sha256(shortPath) };

if (long) {
  const longPath = join(generatedDir, "vslice_600s_1080p30_h264_aac.mp4");
  encode(longPath, 600);
  checksums[`fixtures/media/generated/vslice_600s_1080p30_h264_aac.mp4`] = sha256(longPath);
}

writeFileSync(join(mediaDir, "checksums.json"), JSON.stringify(checksums, null, 2) + "\n");
console.warn("Fixtures generated:\n" + JSON.stringify(checksums, null, 2));
