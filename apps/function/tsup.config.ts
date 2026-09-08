import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  external: ["@azure/functions", "@azure/functions-core"],
  noExternal: [/^(?!@azure\/functions).*/],
});
