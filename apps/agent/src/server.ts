import { fileURLToPath } from "node:url";
import { runMigrations } from "@lessonbuild/db";
// Registers the load hooks that enforce @langchain/langgraph precedence. Must be
// imported before startServer resolves any graph. Deep import (no exports map) —
// see langgraph-api.d.ts for the local type shim.
import "@langchain/langgraph-api/dist/preload.mjs";
import { GRAPH_SPEC } from "@langchain/langgraph-api/dist/graph/load.mjs";
import { runGraphSchemaWorker } from "@langchain/langgraph-api/dist/graph/load.utils.mjs";
import { startServer } from "@langchain/langgraph-api/dist/server.mjs";

await runMigrations().catch((e: unknown) => {
  console.error("migration failed", e);
  process.exit(1);
});

// Graphs are resolved relative to `cwd`. In prod we run the compiled bundle, so
// point at the emitted `dist/graph.js` (this file lives next to it). tsx isn't
// present in the runner, hence a compiled `.js` rather than the `.ts` source
// that `langgraphjs dev` loads locally.
const distDir = fileURLToPath(new URL(".", import.meta.url));

const { host } = await startServer({
  port: Number(process.env["PORT"] ?? 2024),
  host: process.env["HOST"] ?? "0.0.0.0",
  nWorkers: Number(process.env["N_WORKERS"] ?? 10),
  cwd: distDir,
  graphs: { lesson: "./graph.js:graph" },
});

// The LangGraph API schema worker parses TypeScript reliably, but crashes on
// esbuild's bundled/transpiled JS with `Cannot read properties of undefined
// (reading 'flags')`. Keep runtime execution on compiled `dist/graph.js`, while
// pointing schema extraction at the copied TS source that mirrors it.
const lessonSpec = GRAPH_SPEC["lesson"];
if (lessonSpec) {
  lessonSpec.sourceFile = fileURLToPath(new URL("../src/graph.ts", import.meta.url));
  // Validate at startup so schema endpoints don't fail later at request time.
  await runGraphSchemaWorker(lessonSpec).catch((error: unknown) => {
    console.warn("lesson schema preflight failed", error);
  });
}

console.log(`LangGraph API server listening on ${host}`);
