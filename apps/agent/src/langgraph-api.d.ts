// The @langchain/langgraph-api package ships no type declarations and no
// `exports` map, so we deep-import its compiled ESM entrypoints. These minimal
// declarations cover only the surface we use to boot the graph server in prod,
// keeping us within the strict no-`any` standard.

declare module "@langchain/langgraph-api/dist/preload.mjs" {
  // Side-effect only: registers the module load hooks. No exports.
}

declare module "@langchain/langgraph-api/dist/graph/load.mjs" {
  export interface GraphSpec {
    sourceFile: string;
    exportSymbol: string | undefined;
  }

  export const GRAPH_SPEC: Record<string, GraphSpec | undefined>;
}

declare module "@langchain/langgraph-api/dist/graph/load.utils.mjs" {
  import type { GraphSpec } from "@langchain/langgraph-api/dist/graph/load.mjs";

  export function runGraphSchemaWorker(spec: GraphSpec): Promise<unknown>;
}

declare module "@langchain/langgraph-api/dist/server.mjs" {
  export interface StartServerOptions {
    port: number;
    nWorkers: number;
    host: string;
    cwd: string;
    /** graphId -> "relativeFile.js:exportName" */
    graphs: Record<string, string>;
  }

  export interface StartedServer {
    host: string;
    cleanup: () => Promise<void>;
  }

  export function startServer(options: StartServerOptions): Promise<StartedServer>;
}
