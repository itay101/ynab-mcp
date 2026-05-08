# YNAB MCP OAuth Design

**Date:** 2026-05-08
**Status:** Approved

## Overview

Replace the static `YNAB_API_TOKEN` environment variable with YNAB OAuth 2.0, using the MCP protocol's built-in authorization spec. Each user authenticates with their own YNAB account. The server holds minimal in-memory state only during the OAuth handshake (~30 seconds); after that it is fully stateless. Tokens are held by the MCP client (Claude Desktop) and sent as Bearer tokens on every request.

---

## Goals

- Multi-user support: each person uses their own YNAB account
- Authenticate once; Claude Desktop stores and silently refreshes tokens
- No persistent server-side token storage
- Full MCP authorization spec compliance (2025-03-26)
- Preserve stdio mode for single-user local use (personal access token)

---

## Why Our Server Must Be the OAuth Callback

YNAB requires redirect URIs to be pre-registered in the OAuth app. Claude Desktop uses a random localhost port for its redirect URI (e.g. `http://localhost:54321/callback`), which cannot be pre-registered. Therefore our Railway server acts as the OAuth callback: we receive the code from YNAB, exchange it for tokens server-side, then redirect the MCP client to its own localhost URI with a short-lived code we issue.

---

## Architecture

```
Claude Desktop
  │
  ├─ 1. OAuth dance
  │     ├─ GET  /authorize  ──► store pending state ──► redirect to YNAB
  │     ├─ GET  /oauth/callback  ◄── YNAB redirects here with code
  │     │         └─ exchange code with YNAB ──► issue our own code
  │     │         └─ redirect to Claude Desktop localhost URI
  │     └─ POST /token  ──► verify PKCE + return YNAB tokens
  │
  ├─ 2. Token refresh (silent)
  │     └─ POST /token (grant_type=refresh_token) ──► proxy to YNAB
  │
  └─ 3. MCP calls
        └─ POST /mcp
              ├─ requireBearerAuth ──► GET /v1/user (YNAB verify)
              └─ McpServer(token) ──► YNAB API
```

The server uses **Express** (required by the MCP SDK's auth router). OAuth logic lives in a custom `YNABOAuthProvider` class that implements the SDK's `OAuthServerProvider` interface.

---

## OAuth Flow (step by step)

1. Claude Desktop connects to `POST /mcp` without a token → receives **401** with `WWW-Authenticate` pointing to `/.well-known/oauth-protected-resource`
2. Client reads `/.well-known/oauth-authorization-server` → discovers `/register`, `/authorize`, `/token`
3. Client **registers** at `/register` → receives our YNAB `client_id` back; redirect URIs are stored in memory
4. Client opens browser to our `/authorize?client_id=...&redirect_uri=http://localhost:PORT/cb&code_challenge=...&state=CLIENT_STATE`
5. Our server:
   - Generates a random `server_state`
   - Stores in `pendingAuths`: `server_state → {clientRedirectUri, clientState, codeChallenge, clientId}`
   - Redirects to `https://app.ynab.com/oauth/authorize?client_id=YNAB_CLIENT_ID&redirect_uri=RAILWAY_CALLBACK&state=server_state`
6. User logs into YNAB and approves → YNAB redirects to `https://ynab-mcp-production-826d.up.railway.app/oauth/callback?code=YNAB_CODE&state=server_state`
7. Our server (`/oauth/callback`):
   - Looks up `server_state` → retrieves pending auth
   - POSTs to `https://api.youneedabudget.com/oauth/token` with `YNAB_CODE` and `client_secret`
   - Receives YNAB `access_token` + `refresh_token`
   - Generates `our_code` (UUID)
   - Stores in `pendingCodes`: `our_code → {ynabAccessToken, ynabRefreshToken, codeChallenge, expiresAt: +5min}`
   - Redirects to `http://localhost:PORT/cb?code=our_code&state=CLIENT_STATE`
8. Client POSTs `our_code` + PKCE verifier to `/token`
9. Our server verifies PKCE (`SHA256(verifier) == codeChallenge`), returns YNAB tokens, deletes `our_code`
10. All future `/mcp` requests include `Authorization: Bearer <ynab_access_token>`
11. Server verifies token via `GET https://api.youneedabudget.com/v1/user`; passes token to YNAB API

**Token refresh:** Claude Desktop calls `/token` with `grant_type=refresh_token` → proxied directly to YNAB → new tokens returned.

**Re-authentication required only if:** access is revoked in YNAB, or Claude Desktop's stored credentials are cleared.

---

## In-Memory State

Two short-lived Maps, cleared on expiry:

| Map | Key | Value | TTL |
|---|---|---|---|
| `pendingAuths` | `server_state` (UUID) | `{clientRedirectUri, clientState, codeChallenge, clientId}` | 10 min |
| `pendingCodes` | `our_code` (UUID) | `{ynabAccessToken, ynabRefreshToken, codeChallenge}` | 5 min |

Both maps are in-process memory only. On Railway restart they clear; Claude Desktop will re-trigger the OAuth flow automatically on next connection attempt (only the ~30-second handshake window is affected, not established sessions).

---

## Components

### `src/auth.ts` (new)

**`YNABOAuthProvider`** — implements `OAuthServerProvider`:

- `clientsStore` — in-memory Map of registered MCP clients (keyed by our YNAB `client_id`); accumulates redirect URIs across registrations
- `authorize(client, params, res)` — stores pending auth state, redirects to YNAB with our Railway callback URL
- `handleCallback(code, serverState)` — called from `/oauth/callback` route; exchanges code with YNAB, issues `our_code`, returns redirect URL
- `challengeForAuthorizationCode(client, code)` — returns stored `codeChallenge` so SDK validates PKCE
- `exchangeAuthorizationCode(client, code, ...)` — verifies PKCE (via SDK), returns YNAB tokens, clears pending code
- `exchangeRefreshToken(client, refreshToken, ...)` — proxies to YNAB token endpoint
- `verifyAccessToken(token)` — calls `GET https://api.youneedabudget.com/v1/user`; returns `AuthInfo`

### `src/client.ts` (updated)

```ts
export function getClient(token: string): ynab.API {
  return new ynab.API(token);
}
```

Removes env-var singleton. `ynab.API` construction is cheap.

### `src/tools/*.ts` (updated — all 7 files)

`register(server: McpServer)` → `register(server: McpServer, token: string)`

Each tool handler calls `getClient(token)` instead of `getClient()`.

### `src/index.ts` (updated)

```
Express app
├─ express.json()
├─ mcpAuthRouter({ provider, issuerUrl: SERVER_URL, ... })
├─ GET /oauth/callback  →  provider.handleCallback() → redirect
├─ POST /mcp  →  requireBearerAuth → mcpHandler(token)
└─ GET  /mcp  →  requireBearerAuth → mcpHandler(token)  (SSE)
```

HTTP mode when `PORT` is set; stdio mode otherwise (uses `YNAB_API_TOKEN` env var, unchanged).

---

## Environment Variables

| Variable | Description |
|---|---|
| `YNAB_CLIENT_ID` | Client ID from YNAB OAuth app |
| `YNAB_CLIENT_SECRET` | Client secret from YNAB OAuth app |
| `SERVER_URL` | `https://ynab-mcp-production-826d.up.railway.app` |
| `PORT` | Set automatically by Railway |
| `YNAB_API_TOKEN` | Still used in stdio/local mode only |

---

## YNAB OAuth App Configuration

Add this redirect URI to your YNAB OAuth app:

```
https://ynab-mcp-production-826d.up.railway.app/oauth/callback
```

This is the only URI our server uses when talking to YNAB. Claude Desktop's localhost URI never reaches YNAB.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Missing/invalid Bearer token | `requireBearerAuth` returns 401 automatically |
| YNAB token expired | Client calls `/token` with refresh token; transparent to user |
| `server_state` not found in callback | 400 response: "OAuth state not found or expired" |
| `our_code` not found or expired at `/token` | 400 response: "Authorization code not found or expired" |
| PKCE verification fails | 400 response from SDK |
| YNAB API error in a tool | Tool returns error message in MCP response |
| Missing `YNAB_CLIENT_ID`/`YNAB_CLIENT_SECRET` at startup | Server logs and exits with code 1 |

---

## Out of Scope

- Token caching / YNAB API response caching
- User management or per-user rate limiting
- Multi-instance Railway deployments (in-memory state is per-process)
- Revoking tokens from the MCP server side (users revoke in YNAB directly)
