import { describe, it, expect, afterAll } from "vitest";
import { getPool } from "./client";

afterAll(async () => {
  await getPool().end();
});

describe("getPool", () => {
  it("sizes the pool for concurrent request bursts instead of pg defaults", () => {
    const options = getPool().options;
    expect(options.max).toBe(20);
    expect(options.connectionTimeoutMillis).toBe(5_000);
  });
});
