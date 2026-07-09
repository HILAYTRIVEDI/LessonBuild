import { fileURLToPath } from "node:url";
import { runMigrations } from "@lessonbuild/db";
// Registers the load hooks that enforce @langchain/langgraph precedence. Must be
// imported before startServer resolves any graph. Deep import (no exports map) —
// see langgraph-api.d.ts for the local type shim.
import "@langchain/langgraph-api/dist/preload.mjs";
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

console.log(`LangGraph API server listening on ${host}`);
