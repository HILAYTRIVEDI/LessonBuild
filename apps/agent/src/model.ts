import { ChatOpenAI } from "@langchain/openai";

/** Builds the configured AI/ML API-backed chat model for all agent nodes. */
export function getModel() {
  const apiKey = process.env["AIMLAPI_KEY"];
  if (!apiKey) {
    throw new Error("AIMLAPI_KEY is not set");
  }
  return new ChatOpenAI({
    model: process.env["LLM_MODEL"] ?? "claude-sonnet-5",
    apiKey,
    configuration: { baseURL: "https://api.aimlapi.com/v1" },
    temperature: 0.2,
  });
}
