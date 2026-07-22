import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit + integration tests live beside sources and under tests/.
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    // Media tests shell out to ffmpeg/ffprobe and can take longer.
    testTimeout: 30_000,
  },
});
