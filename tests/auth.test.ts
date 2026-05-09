import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { YNABOAuthProvider } from "../src/auth.js";
import {
  InvalidTokenError,
  InvalidGrantError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";

const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
const SERVER_URL = "https://example.railway.app";

function makeProvider() {
  return new YNABOAuthProvider(CLIENT_ID, CLIENT_SECRET, SERVER_URL);
}

// Minimal OAuthClientInformationFull stub
const fakeClient = {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  redirect_uris: ["http://localhost:3000/callback"],
};

describe("YNABOAuthProvider.clientsStore", () => {
  it("registerClient stores client and returns a unique UUID as client_id", async () => {
    const provider = makeProvider();
    const registered = await provider.clientsStore.registerClient!({
      redirect_uris: ["http://localhost:4321/cb"],
    } as Parameters<typeof provider.clientsStore.registerClient>[0]);

    expect(registered.client_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(registered.client_secret).toBeUndefined();
    expect(registered.redirect_uris).toContain("http://localhost:4321/cb");
  });

  it("two registrations get independent client_ids and do not share redirect URIs", async () => {
    const provider = makeProvider();
    const a = await provider.clientsStore.registerClient!({
      redirect_uris: ["http://localhost:1111/cb"],
    } as Parameters<typeof provider.clientsStore.registerClient>[0]);
    const b = await provider.clientsStore.registerClient!({
      redirect_uris: ["http://localhost:2222/cb"],
    } as Parameters<typeof provider.clientsStore.registerClient>[0]);

    expect(a.client_id).not.toBe(b.client_id);

    const clientA = await provider.clientsStore.getClient(a.client_id);
    const clientB = await provider.clientsStore.getClient(b.client_id);
    expect(clientA!.redirect_uris).toEqual(["http://localhost:1111/cb"]);
    expect(clientB!.redirect_uris).toEqual(["http://localhost:2222/cb"]);
  });

  it("getClient returns previously registered client by its UUID", async () => {
    const provider = makeProvider();
    const registered = await provider.clientsStore.registerClient!({
      redirect_uris: ["http://localhost:4321/cb"],
    } as Parameters<typeof provider.clientsStore.registerClient>[0]);

    const found = await provider.clientsStore.getClient(registered.client_id);
    expect(found).toBeDefined();
    expect(found!.client_id).toBe(registered.client_id);
  });

  it("getClient returns undefined for unknown clientId", async () => {
    const provider = makeProvider();
    const found = await provider.clientsStore.getClient("unknown");
    expect(found).toBeUndefined();
  });

  it("registerClient rejects non-localhost redirect URIs", () => {
    const provider = makeProvider();
    expect(() =>
      provider.clientsStore.registerClient!({
        redirect_uris: ["https://attacker.example.com/cb"],
      } as Parameters<typeof provider.clientsStore.registerClient>[0])
    ).toThrow("Redirect URI must use localhost");
  });

  it("registerClient accepts 127.0.0.1 redirect URIs", async () => {
    const provider = makeProvider();
    const registered = await provider.clientsStore.registerClient!({
      redirect_uris: ["http://127.0.0.1:8080/cb"],
    } as Parameters<typeof provider.clientsStore.registerClient>[0]);
    expect(registered.redirect_uris).toContain("http://127.0.0.1:8080/cb");
  });

  it("persists clients to file so a new provider instance can find them", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ynab-mcp-test-"));
    const file = join(dir, "clients.json");
    try {
      const p1 = new YNABOAuthProvider(CLIENT_ID, CLIENT_SECRET, SERVER_URL, file);
      const reg = await p1.clientsStore.registerClient!({
        redirect_uris: ["http://localhost:4321/cb"],
      } as Parameters<typeof p1.clientsStore.registerClient>[0]);

      // Second instance loads from the same file — simulates a server restart
      const p2 = new YNABOAuthProvider(CLIENT_ID, CLIENT_SECRET, SERVER_URL, file);
      const found = await p2.clientsStore.getClient(reg.client_id);
      expect(found).toBeDefined();
      expect(found!.client_id).toBe(reg.client_id);
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("YNABOAuthProvider.verifyAccessToken", () => {
  it("returns AuthInfo when YNAB responds 200", async () => {
    const provider = makeProvider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));

    const info = await provider.verifyAccessToken("valid-token");
    expect(info.token).toBe("valid-token");
    expect(info.clientId).toBe(CLIENT_ID);
    expect(typeof info.expiresAt).toBe("number");
    vi.unstubAllGlobals();
  });

  it("throws InvalidTokenError when YNAB responds non-200", async () => {
    const provider = makeProvider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(provider.verifyAccessToken("bad-token")).rejects.toThrow(InvalidTokenError);
    await expect(provider.verifyAccessToken("bad-token")).rejects.toThrow(
      "Invalid or expired YNAB token"
    );
    vi.unstubAllGlobals();
  });
});

describe("YNABOAuthProvider.handleCallback", () => {
  it("throws when state is unknown", async () => {
    const provider = makeProvider();
    await expect(provider.handleCallback("code", "unknown-state")).rejects.toThrow(
      "OAuth state not found or expired"
    );
  });

  it("exchanges code with YNAB and returns redirect URL", async () => {
    const provider = makeProvider();

    // Seed a pending auth by calling authorize
    const fakeRes = { redirect: vi.fn() } as unknown as import("express").Response;
    await provider.authorize(fakeClient as never, {
      redirectUri: "http://localhost:9999/cb",
      state: "client-state",
      codeChallenge: "abc123",
      scopes: [],
    }, fakeRes);

    // Extract server_state from the redirect call
    const redirectedUrl = new URL((fakeRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    const serverState = redirectedUrl.searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "ynab-at", refresh_token: "ynab-rt" }),
      })
    );

    const redirectUrl = await provider.handleCallback("ynab-code", serverState);
    const parsed = new URL(redirectUrl);

    expect(parsed.origin + parsed.pathname).toBe("http://localhost:9999/cb");
    expect(parsed.searchParams.get("state")).toBe("client-state");
    expect(parsed.searchParams.get("code")).toBeTruthy(); // our_code UUID
    vi.unstubAllGlobals();
  });
});

describe("YNABOAuthProvider.challengeForAuthorizationCode + exchangeAuthorizationCode", () => {
  async function setupPendingCode(provider: YNABOAuthProvider): Promise<string> {
    const fakeRes = { redirect: vi.fn() } as unknown as import("express").Response;
    await provider.authorize(fakeClient as never, {
      redirectUri: "http://localhost:9999/cb",
      codeChallenge: "challenge-xyz",
      scopes: [],
    }, fakeRes);
    const redirectedUrl = new URL((fakeRes.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    const serverState = redirectedUrl.searchParams.get("state")!;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "ynab-at", refresh_token: "ynab-rt" }),
      })
    );
    const redirectUrl = await provider.handleCallback("code", serverState);
    vi.unstubAllGlobals();
    return new URL(redirectUrl).searchParams.get("code")!;
  }

  it("challengeForAuthorizationCode returns stored challenge", async () => {
    const provider = makeProvider();
    const ourCode = await setupPendingCode(provider);
    const challenge = await provider.challengeForAuthorizationCode(fakeClient as never, ourCode);
    expect(challenge).toBe("challenge-xyz");
  });

  it("challengeForAuthorizationCode throws for unknown code", async () => {
    const provider = makeProvider();
    await expect(
      provider.challengeForAuthorizationCode(fakeClient as never, "unknown-code")
    ).rejects.toThrow("Authorization code not found or expired");
  });

  it("exchangeAuthorizationCode returns YNAB tokens and deletes code", async () => {
    const provider = makeProvider();
    const ourCode = await setupPendingCode(provider);
    const tokens = await provider.exchangeAuthorizationCode(fakeClient as never, ourCode);

    expect(tokens.access_token).toBe("ynab-at");
    expect(tokens.refresh_token).toBe("ynab-rt");
    expect(tokens.token_type).toBe("bearer");

    // Code should be consumed — second call must throw
    await expect(
      provider.exchangeAuthorizationCode(fakeClient as never, ourCode)
    ).rejects.toThrow("Authorization code not found or expired");
  });
});

describe("YNABOAuthProvider.exchangeRefreshToken", () => {
  it("proxies to YNAB token endpoint and returns new tokens", async () => {
    const provider = makeProvider();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: "new-at", refresh_token: "new-rt" }),
      })
    );

    const tokens = await provider.exchangeRefreshToken(fakeClient as never, "old-rt");
    expect(tokens.access_token).toBe("new-at");
    expect(tokens.refresh_token).toBe("new-rt");
    vi.unstubAllGlobals();
  });

  it("throws InvalidGrantError when YNAB token refresh fails", async () => {
    const provider = makeProvider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(provider.exchangeRefreshToken(fakeClient as never, "bad-rt")).rejects.toThrow(InvalidGrantError);
    await expect(provider.exchangeRefreshToken(fakeClient as never, "bad-rt")).rejects.toThrow(
      "YNAB token refresh failed: 400"
    );
    vi.unstubAllGlobals();
  });
});
