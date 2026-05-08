# YNAB OAuth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `YNAB_API_TOKEN` env var with YNAB OAuth 2.0 so multiple users can each authenticate with their own YNAB account.

**Architecture:** Express replaces raw `node:http`. A custom `YNABOAuthProvider` implements the MCP SDK's `OAuthServerProvider` interface, acting as the OAuth callback to work around YNAB's pre-registered redirect URI requirement. The YNAB access token flows from the Bearer header into each per-request `McpServer`, replacing the env-var singleton in `client.ts`.

**Tech Stack:** Express, MCP SDK auth router (`@modelcontextprotocol/sdk/server/auth/router.js`), YNAB OAuth 2.0, Vitest for tests.

---

## File Map

| File | Change |
|---|---|
| `package.json` | Add `express` dep, `@types/express` devDep |
| `src/client.ts` | Remove singleton; `getClient(token: string): ynab.API` |
| `src/auth.ts` | **New** — `YNABOAuthProvider` class |
| `src/tools/budgets.ts` | Add `token` param to exported functions + `register` |
| `src/tools/accounts.ts` | Same |
| `src/tools/categories.ts` | Same |
| `src/tools/months.ts` | Same |
| `src/tools/payees.ts` | Same |
| `src/tools/scheduled_transactions.ts` | Same |
| `src/tools/transactions.ts` | Same |
| `src/index.ts` | Rewrite HTTP path to use Express + auth; keep stdio path |
| `tests/client.test.ts` | Update for new `getClient(token)` signature |
| `tests/auth.test.ts` | **New** — unit tests for `YNABOAuthProvider` |

---

## Task 1: Add `express` and `@types/express`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /path/to/ynab-mcp
npm install express
npm install --save-dev @types/express
```

Expected output: updated `package.json` and `package-lock.json`, no errors.

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add express and @types/express"
```

---

## Task 2: Update `src/client.ts`

**Files:**
- Modify: `src/client.ts`
- Modify: `tests/client.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the entire contents of `tests/client.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test -- tests/client.test.ts
```

Expected: 2 failures (old singleton signature doesn't match).

- [ ] **Step 3: Rewrite `src/client.ts`**

```typescript
import * as ynab from "ynab";

export function getClient(token: string): ynab.API {
  return new ynab.API(token);
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- tests/client.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add src/client.ts tests/client.test.ts
git commit -m "refactor: replace getClient singleton with token parameter"
```

---

## Task 3: Update all 7 tool files

All tool files follow the same pattern: add `token: string` to each exported function, update `getClient()` → `getClient(token)`, and add `token: string` to `register`.

**Files:**
- Modify: `src/tools/budgets.ts`
- Modify: `src/tools/accounts.ts`
- Modify: `src/tools/categories.ts`
- Modify: `src/tools/months.ts`
- Modify: `src/tools/payees.ts`
- Modify: `src/tools/scheduled_transactions.ts`
- Modify: `src/tools/transactions.ts`

_(No new tests — the tools have no unit tests and their behaviour is unchanged. Build verification serves as the check.)_

- [ ] **Step 1: Update `src/tools/budgets.ts`**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

export async function listBudgets(args: { include_accounts?: boolean }, token: string) {
  const client = getClient(token);
  const response = await client.budgets.getBudgets(args.include_accounts);
  return response.data;
}

export async function getBudget(
  args: { budget_id?: string; last_knowledge_of_server?: number },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.budgets.getBudgetById(budgetId, args.last_knowledge_of_server);
  return response.data;
}

export function register(server: McpServer, token: string): void {
  server.tool(
    "list_budgets",
    "List all budgets accessible to the authenticated user.",
    { include_accounts: z.boolean().optional().describe("Include account details for each budget.") },
    (args) => wrapHandler(() => listBudgets(args, token))
  );

  server.tool(
    "get_budget",
    "Get a single budget by ID, including settings and currency format.",
    { budget_id: budgetIdSchema, last_knowledge_of_server: lastKnowledgeSchema },
    (args) => wrapHandler(() => getBudget(args, token))
  );
}
```

- [ ] **Step 2: Update `src/tools/accounts.ts`**

For every exported `async function` (`listAccounts`, `getAccount`): add `, token: string` as the last parameter and change `const client = getClient()` → `const client = getClient(token)`.

Change `register` signature: `export function register(server: McpServer, token: string): void`

In each `server.tool(...)` handler: change `() => fn(args)` → `() => fn(args, token)`.

- [ ] **Step 3: Update `src/tools/categories.ts`**

Functions: `listCategories`, `getCategory`, `updateCategoryBudget` — add `, token: string`, change `getClient()` → `getClient(token)`.

Change `register` signature to `register(server: McpServer, token: string): void` and thread `token` into each handler.

- [ ] **Step 4: Update `src/tools/months.ts`**

Functions: `listBudgetMonths`, `getBudgetMonth` — add `, token: string`, change `getClient()` → `getClient(token)`.

Change `register` signature to `register(server: McpServer, token: string): void` and thread `token` into each handler.

- [ ] **Step 5: Update `src/tools/payees.ts`**

Functions: `listPayees`, `getPayee`, `listPayeeLocations`, `getPayeeLocation` — add `, token: string`, change `getClient()` → `getClient(token)`.

Change `register` signature to `register(server: McpServer, token: string): void` and thread `token` into each handler.

- [ ] **Step 6: Update `src/tools/scheduled_transactions.ts`**

Functions: `listScheduledTransactions`, `getScheduledTransaction`, `createScheduledTransaction`, `updateScheduledTransaction`, `deleteScheduledTransaction` — add `, token: string`, change `getClient()` → `getClient(token)`.

Change `register` signature to `register(server: McpServer, token: string): void` and thread `token` into each handler.

- [ ] **Step 7: Update `src/tools/transactions.ts`**

Functions: `listTransactions`, `getTransaction`, `createTransaction`, `updateTransaction`, `deleteTransaction`, `bulkCreateTransactions`, `listTransactionsByAccount`, `listTransactionsByCategory`, `listTransactionsByPayee` — add `, token: string`, change `getClient()` → `getClient(token)`.

Change `register` signature to `register(server: McpServer, token: string): void` and thread `token` into each handler.

- [ ] **Step 8: Verify build passes**

```bash
npm run build
```

Expected: exits 0. If TypeScript reports any `getClient()` call without an argument, that file was missed — fix it.

- [ ] **Step 9: Commit**

```bash
git add src/tools/
git commit -m "refactor: thread token parameter through all tool register functions"
```

---

## Task 4: Create `src/auth.ts`

**Files:**
- Create: `src/auth.ts`
- Create: `tests/auth.test.ts`

- [ ] **Step 1: Write failing tests in `tests/auth.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { YNABOAuthProvider } from "../src/auth.js";

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
  it("registerClient stores client and returns our YNAB client_id", async () => {
    const provider = makeProvider();
    const registered = await provider.clientsStore.registerClient!({
      redirect_uris: ["http://localhost:4321/cb"],
    } as Parameters<typeof provider.clientsStore.registerClient>[0]);

    expect(registered.client_id).toBe(CLIENT_ID);
    expect(registered.client_secret).toBe(CLIENT_SECRET);
    expect(registered.redirect_uris).toContain("http://localhost:4321/cb");
  });

  it("getClient returns previously registered client", async () => {
    const provider = makeProvider();
    await provider.clientsStore.registerClient!({
      redirect_uris: ["http://localhost:4321/cb"],
    } as Parameters<typeof provider.clientsStore.registerClient>[0]);

    const found = await provider.clientsStore.getClient(CLIENT_ID);
    expect(found).toBeDefined();
    expect(found!.client_id).toBe(CLIENT_ID);
  });

  it("getClient returns undefined for unknown clientId", async () => {
    const provider = makeProvider();
    const found = await provider.clientsStore.getClient("unknown");
    expect(found).toBeUndefined();
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

  it("throws when YNAB responds non-200", async () => {
    const provider = makeProvider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

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

  it("throws when YNAB token refresh fails", async () => {
    const provider = makeProvider();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(provider.exchangeRefreshToken(fakeClient as never, "bad-rt")).rejects.toThrow(
      "YNAB token refresh failed: 400"
    );
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run tests — expect failures (file not found)**

```bash
npm test -- tests/auth.test.ts
```

Expected: error that `../src/auth.js` cannot be resolved.

- [ ] **Step 3: Create `src/auth.ts`**

```typescript
import { randomUUID } from "node:crypto";
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

const YNAB_AUTHORIZE_URL = "https://app.ynab.com/oauth/authorize";
const YNAB_TOKEN_URL = "https://api.youneedabudget.com/oauth/token";
const YNAB_USER_URL = "https://api.youneedabudget.com/v1/user";

interface PendingAuth {
  clientRedirectUri: string;
  clientState?: string;
  codeChallenge: string;
  expiresAt: number;
}

interface PendingCode {
  ynabAccessToken: string;
  ynabRefreshToken: string;
  codeChallenge: string;
  expiresAt: number;
}

export class YNABOAuthProvider implements OAuthServerProvider {
  private readonly ynabClientId: string;
  private readonly ynabClientSecret: string;
  private readonly callbackUrl: string;

  private readonly _clients = new Map<string, OAuthClientInformationFull>();
  private readonly _pendingAuths = new Map<string, PendingAuth>();
  private readonly _pendingCodes = new Map<string, PendingCode>();

  constructor(ynabClientId: string, ynabClientSecret: string, serverUrl: string) {
    this.ynabClientId = ynabClientId;
    this.ynabClientSecret = ynabClientSecret;
    this.callbackUrl = `${serverUrl}/oauth/callback`;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => this._clients.get(clientId),
      registerClient: (clientData) => {
        const existing = this._clients.get(this.ynabClientId);
        const mergedUris = [
          ...new Set([
            ...(existing?.redirect_uris ?? []),
            ...clientData.redirect_uris,
          ]),
        ];
        const client: OAuthClientInformationFull = {
          ...clientData,
          redirect_uris: mergedUris,
          client_id: this.ynabClientId,
          client_secret: this.ynabClientSecret,
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        this._clients.set(this.ynabClientId, client);
        return client;
      },
    };
  }

  async authorize(
    _client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    this._cleanupExpired();
    const serverState = randomUUID();
    this._pendingAuths.set(serverState, {
      clientRedirectUri: params.redirectUri,
      clientState: params.state,
      codeChallenge: params.codeChallenge,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const url = new URL(YNAB_AUTHORIZE_URL);
    url.searchParams.set("client_id", this.ynabClientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.callbackUrl);
    url.searchParams.set("state", serverState);
    res.redirect(url.toString());
  }

  async handleCallback(code: string, serverState: string): Promise<string> {
    this._cleanupExpired();
    const pending = this._pendingAuths.get(serverState);
    if (!pending) throw new Error("OAuth state not found or expired");
    this._pendingAuths.delete(serverState);

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: this.ynabClientId,
      client_secret: this.ynabClientSecret,
      redirect_uri: this.callbackUrl,
    });
    const response = await fetch(YNAB_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!response.ok) {
      throw new Error(`YNAB token exchange failed: ${response.status}`);
    }
    const tokens = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };

    const ourCode = randomUUID();
    this._pendingCodes.set(ourCode, {
      ynabAccessToken: tokens.access_token,
      ynabRefreshToken: tokens.refresh_token,
      codeChallenge: pending.codeChallenge,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    const redirectUrl = new URL(pending.clientRedirectUri);
    redirectUrl.searchParams.set("code", ourCode);
    if (pending.clientState) redirectUrl.searchParams.set("state", pending.clientState);
    return redirectUrl.toString();
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    code: string
  ): Promise<string> {
    return this._pendingCodes.get(code)?.codeChallenge ?? "";
  }

  async exchangeAuthorizationCode(
    _client: OAuthClientInformationFull,
    code: string
  ): Promise<OAuthTokens> {
    this._cleanupExpired();
    const pending = this._pendingCodes.get(code);
    if (!pending) throw new Error("Authorization code not found or expired");
    this._pendingCodes.delete(code);
    return {
      access_token: pending.ynabAccessToken,
      refresh_token: pending.ynabRefreshToken,
      token_type: "bearer",
      expires_in: 7200,
    };
  }

  async exchangeRefreshToken(
    _client: OAuthClientInformationFull,
    refreshToken: string
  ): Promise<OAuthTokens> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: this.ynabClientId,
      client_secret: this.ynabClientSecret,
    });
    const response = await fetch(YNAB_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (!response.ok) {
      throw new Error(`YNAB token refresh failed: ${response.status}`);
    }
    const tokens = (await response.json()) as {
      access_token: string;
      refresh_token: string;
    };
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: "bearer",
      expires_in: 7200,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const response = await fetch(YNAB_USER_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("Invalid or expired YNAB token");
    return {
      token,
      clientId: this.ynabClientId,
      scopes: [],
      expiresAt: Math.floor(Date.now() / 1000) + 7200,
    };
  }

  private _cleanupExpired(): void {
    const now = Date.now();
    for (const [k, v] of this._pendingAuths) if (now > v.expiresAt) this._pendingAuths.delete(k);
    for (const [k, v] of this._pendingCodes) if (now > v.expiresAt) this._pendingCodes.delete(k);
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test -- tests/auth.test.ts
```

Expected: all tests green.

- [ ] **Step 5: Verify full build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/auth.ts tests/auth.test.ts
git commit -m "feat: add YNABOAuthProvider with callback-proxy OAuth flow"
```

---

## Task 5: Rewrite `src/index.ts`

**Files:**
- Modify: `src/index.ts`

_(Integration-level — tested by running the build and manually verifying startup logs.)_

- [ ] **Step 1: Replace `src/index.ts` entirely**

```typescript
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { YNABOAuthProvider } from "./auth.js";
import { register as registerBudgets } from "./tools/budgets.js";
import { register as registerAccounts } from "./tools/accounts.js";
import { register as registerCategories } from "./tools/categories.js";
import { register as registerPayees } from "./tools/payees.js";
import { register as registerTransactions } from "./tools/transactions.js";
import { register as registerScheduledTransactions } from "./tools/scheduled_transactions.js";
import { register as registerMonths } from "./tools/months.js";

function createMcpServer(token: string): McpServer {
  const server = new McpServer({ name: "ynab-mcp", version: "1.0.0" });
  registerBudgets(server, token);
  registerAccounts(server, token);
  registerCategories(server, token);
  registerPayees(server, token);
  registerTransactions(server, token);
  registerScheduledTransactions(server, token);
  registerMonths(server, token);
  return server;
}

if (process.env.PORT) {
  // ── HTTP mode (Railway) ──────────────────────────────────────────────────
  const ynabClientId = process.env.YNAB_CLIENT_ID;
  const ynabClientSecret = process.env.YNAB_CLIENT_SECRET;
  const serverUrl = process.env.SERVER_URL;

  if (!ynabClientId || !ynabClientSecret || !serverUrl) {
    console.error(
      "Error: YNAB_CLIENT_ID, YNAB_CLIENT_SECRET, and SERVER_URL must be set in HTTP mode."
    );
    process.exit(1);
  }

  const port = parseInt(process.env.PORT, 10);
  const provider = new YNABOAuthProvider(ynabClientId, ynabClientSecret, serverUrl);
  const issuerUrl = new URL(serverUrl);
  const resourceMetadataUrl = `${serverUrl}/.well-known/oauth-protected-resource`;

  const app = express();
  app.use(express.json());
  app.use(mcpAuthRouter({ provider, issuerUrl, resourceName: "YNAB MCP Server" }));

  // YNAB OAuth callback — YNAB redirects here after user approves
  app.get("/oauth/callback", async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;
    if (error) {
      res.status(400).send(`OAuth error: ${error}`);
      return;
    }
    if (!code || !state) {
      res.status(400).send("Missing code or state");
      return;
    }
    try {
      const redirectUrl = await provider.handleCallback(code, state);
      res.redirect(redirectUrl);
    } catch (err) {
      res.status(400).send(err instanceof Error ? err.message : "OAuth callback failed");
    }
  });

  const bearerAuth = requireBearerAuth({ verifier: provider, resourceMetadataUrl });

  async function mcpHandler(req: express.Request, res: express.Response): Promise<void> {
    const token = req.auth!.token;
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer(token);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("finish", () => server.close());
  }

  app.post("/mcp", bearerAuth, mcpHandler);
  app.get("/mcp", bearerAuth, mcpHandler);

  app.listen(port, () => console.log(`ynab-mcp listening on port ${port}`));
} else {
  // ── Stdio mode (local Claude Desktop) ───────────────────────────────────
  const token = process.env.YNAB_API_TOKEN;
  if (!token) {
    console.error("Error: YNAB_API_TOKEN must be set in stdio mode.");
    process.exit(1);
  }
  const server = createMcpServer(token);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 3: Smoke-test HTTP mode locally**

```bash
YNAB_CLIENT_ID=fake YNAB_CLIENT_SECRET=fake SERVER_URL=http://localhost:3001 PORT=3001 node dist/index.js &
sleep 1
curl -s http://localhost:3001/.well-known/oauth-authorization-server | python3 -m json.tool
kill %1
```

Expected: JSON with `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint` fields.

- [ ] **Step 4: Smoke-test stdio mode locally**

```bash
echo '{}' | YNAB_API_TOKEN=fake node dist/index.js
```

Expected: process starts and waits on stdin (no crash, no "YNAB_API_TOKEN must be set" error).
Press Ctrl-C to exit.

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts
git commit -m "feat: replace http server with Express + MCP OAuth for multi-user support"
```

---

## Task 6: Add `YNAB_CLIENT_ID`, `YNAB_CLIENT_SECRET`, and `SERVER_URL` to Railway

_(Manual steps — no code changes.)_

- [ ] **Step 1: Open Railway dashboard → your project → Variables tab**

- [ ] **Step 2: Add variables**

| Key | Value |
|---|---|
| `YNAB_CLIENT_ID` | Your YNAB OAuth app client ID |
| `YNAB_CLIENT_SECRET` | Your YNAB OAuth app client secret |
| `SERVER_URL` | `https://ynab-mcp-production-826d.up.railway.app` |

- [ ] **Step 3: Add Railway callback URL to YNAB OAuth app**

In [app.ynab.com/oauth/applications](https://app.ynab.com/oauth/applications), add this redirect URI:

```
https://ynab-mcp-production-826d.up.railway.app/oauth/callback
```

- [ ] **Step 4: Push branch to trigger Railway redeploy**

```bash
git push
```

- [ ] **Step 5: Verify deployment**

```bash
curl -s https://ynab-mcp-production-826d.up.railway.app/.well-known/oauth-authorization-server | python3 -m json.tool
```

Expected: JSON with `authorization_endpoint` pointing to your Railway URL.

---

## Task 7: Push and open PR

- [ ] **Step 1: Push all commits**

```bash
git push
```

- [ ] **Step 2: Open PR**

Open: `https://github.com/itay101/ynab-mcp/compare/feat/railway-http-transport`

Title: `feat: YNAB OAuth 2.0 for multi-user support`
