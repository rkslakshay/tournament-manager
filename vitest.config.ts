import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: ["src/engine/**/*.ts", "src/server/**/*.ts", "src/lib/**/*.ts"],
      exclude: ["**/__tests__/**", "**/*.test.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: {
        "src/engine/**": { statements: 90, branches: 90, functions: 90, lines: 90 },
      },
    },
  },
});
