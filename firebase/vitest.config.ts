import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["firebase/*.test.ts"],
    fileParallelism: false,
    setupFiles: ["./firebase/setup.ts"],
    hookTimeout: 30000,
    testTimeout: 15000,
  },
});
