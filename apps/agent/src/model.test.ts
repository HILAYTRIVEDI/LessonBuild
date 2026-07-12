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
});
