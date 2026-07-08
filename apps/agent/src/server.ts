import { createServer } from "node:http";

// Lightweight health endpoint for Docker; the LangGraph CLI serves the graph itself in dev.
const port = Number(process.env["AGENT_HEALTH_PORT"] ?? 2024);
createServer((req, res) => {
  if (req.url === "/ok") { res.writeHead(200); res.end("ok"); return; }
  res.writeHead(404); res.end();
}).listen(port);
