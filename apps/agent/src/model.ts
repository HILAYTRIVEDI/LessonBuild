import { ChatOpenAI } from "@langchain/openai";

let model: ChatOpenAI | null = null;

/**
 * Builds the configured AI/ML API-backed chat model for all agent nodes.
 * Memoized so nodes share one client (and its keep-alive connections);
 * stays lazy because AIMLAPI_KEY is only available at runtime.
 */
export function getModel() {
  if (model) return model;
  const apiKey = process.env["AIMLAPI_KEY"];
  if (!apiKey) {
    throw new Error("AIMLAPI_KEY is not set");
  }
  model = new ChatOpenAI({
    model: process.env["LLM_MODEL"] ?? "claude-sonnet-5",
    apiKey,
    configuration: { baseURL: "https://api.aimlapi.com/v1" },
    temperature: 0.2,
  });
  return model;
}
