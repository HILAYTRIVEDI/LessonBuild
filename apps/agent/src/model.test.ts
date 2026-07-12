import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getModel } from "./model.js";

const ORIGINAL_KEY = process.env["AIMLAPI_KEY"];

beforeEach(() => {
  process.env["AIMLAPI_KEY"] = "test-key";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env["AIMLAPI_KEY"];
  } else {
    process.env["AIMLAPI_KEY"] = ORIGINAL_KEY;
  }
});

describe("getModel", () => {
  it("returns the same client instance across calls", () => {
    expect(getModel()).toBe(getModel());
  });

  it("retries transient API failures and bounds request time", () => {
    const model = getModel();
    // ChatOpenAI hands maxRetries to its AsyncCaller rather than storing it.
    const caller = model.caller as unknown as { maxRetries: number };
    expect(caller.maxRetries).toBe(3);
    expect(model.timeout).toBe(60_000);
  });
});
