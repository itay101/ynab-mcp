import { describe, it, expect } from "vitest";
import { toToolResult, toErrorResult, wrapHandler } from "../src/utils.js";

describe("toToolResult", () => {
  it("serialises data as JSON text content", () => {
    const result = toToolResult({ id: "abc" });
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ id: "abc" }, null, 2) }],
    });
  });
});

describe("toErrorResult", () => {
  it("extracts YNAB API error detail", () => {
    const ynabError = { error: { detail: "Subscription lapsed", name: "subscription_lapsed" } };
    const result = toErrorResult(ynabError);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("YNAB API error: Subscription lapsed");
  });

  it("falls back to error.name when detail is missing", () => {
    const ynabError = { error: { name: "not_found" } };
    const result = toErrorResult(ynabError);
    expect(result.content[0].text).toBe("YNAB API error: not_found");
  });

  it("handles plain Error instances", () => {
    const result = toErrorResult(new Error("network failure"));
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("network failure");
  });

  it("handles unknown values", () => {
    const result = toErrorResult("boom");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("boom");
  });
});

describe("wrapHandler", () => {
  it("returns tool result on success", async () => {
    const result = await wrapHandler(async () => ({ id: "x" }));
    expect(result.content[0].text).toContain('"id": "x"');
  });

  it("returns error result when handler throws", async () => {
    const result = await wrapHandler(async () => {
      throw { error: { detail: "Bad request" } };
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("YNAB API error: Bad request");
  });
});
