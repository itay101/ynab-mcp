import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("ynab", () => ({
  API: vi.fn().mockImplementation((token: string) => ({ token })),
}));

describe("getClient", () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    originalToken = process.env.YNAB_API_TOKEN;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.YNAB_API_TOKEN;
    } else {
      process.env.YNAB_API_TOKEN = originalToken;
    }
  });

  it("returns a YNAB API instance when token is set", async () => {
    process.env.YNAB_API_TOKEN = "test-token";
    const { getClient } = await import("../src/client.js");
    const client = getClient();
    expect(client).toBeDefined();
  });

  it("returns the same instance on multiple calls", async () => {
    process.env.YNAB_API_TOKEN = "test-token";
    const { getClient } = await import("../src/client.js");
    const a = getClient();
    const b = getClient();
    expect(a).toBe(b);
  });

  it("calls process.exit(1) when YNAB_API_TOKEN is not set", async () => {
    delete process.env.YNAB_API_TOKEN;
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const { getClient } = await import("../src/client.js");
    expect(() => getClient()).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
