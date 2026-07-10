import { defineConfig } from "tsup";

export default defineConfig({
  // server.ts boots the API; graph.js is resolved at runtime by the langgraph
  // server (graphs: { lesson: "./graph.js:graph" }), so it needs its own entry.
  entry: ["src/server.ts", "src/graph.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Workspace packages ship raw TS with extensionless relative imports that
  // plain `node` can't resolve, so bundle them in; leave real npm deps external
  // (installed in the runner via prod-deps) since esbuild bundling breaks pg's
  // dynamic `require`.
  noExternal: ["@lessonbuild/db", "@lessonbuild/shared"],
  external: ["pg", "zod"],
});
