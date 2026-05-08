import { describe, it, expect, vi } from "vitest";

vi.mock("ynab", () => ({
  API: vi.fn().mockImplementation((token: string) => ({ token })),
}));

describe("getClient", () => {
  it("returns a ynab.API instance for the given token", async () => {
    const { getClient } = await import("../src/client.js");
    const client = getClient("my-token");
    expect(client).toBeDefined();
    expect((client as unknown as { token: string }).token).toBe("my-token");
  });

  it("returns a new instance on each call (no singleton)", async () => {
    const { getClient } = await import("../src/client.js");
    const a = getClient("tok-1");
    const b = getClient("tok-2");
    expect(a).not.toBe(b);
  });
});
