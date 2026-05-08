# YNAB MCP OAuth Design

**Date:** 2026-05-08
**Status:** Approved

## Overview

Replace the static `YNAB_API_TOKEN` environment variable with YNAB OAuth 2.0, using the MCP protocol's built-in authorization spec. Each user authenticates with their own YNAB account. The server is stateless — no database required. Tokens are held by the MCP client (Claude Desktop) and sent as Bearer tokens on every request.

---

## Goals

- Multi-user support: each person uses their own YNAB account
- Authenticate once; Claude Desktop stores and silently refreshes tokens
- No server-side token storage (stateless Railway deployment)
- Full MCP authorization spec compliance (2025-03-26)

---

## Architecture

```
Claude Desktop
  │
  ├─ OAuth dance ──► Express auth routes (mcpAuthRouter)
  │                      │
  │                      └──► YNAB OAuth (proxy)
  │                           https://app.ynab.com/oauth/authorize
  │                           https://api.youneedabudget.com/oauth/token
  │
  └─ MCP calls ──► POST /mcp
                   ├─ requireBearerAuth middleware
                   │     └─ verifyAccessToken → GET /v1/user (YNAB)
                   └─ McpServer(token) → YNAB API
```

The server switches from raw `node:http` to **Express**, required by the MCP SDK's auth router. The SDK's `ProxyOAuthServerProvider` handles all OAuth plumbing — we provide YNAB's endpoint URLs, a token verifier, and a client lookup function.

---

## OAuth Flow

1. Claude Desktop connects to `POST /mcp` without a token → receives **401** with `WWW-Authenticate` header pointing to `/.well-known/oauth-protected-resource`
2. Client reads `/.well-known/oauth-authorization-server` → discovers `/register`, `/authorize`, `/token` endpoints
3. Client **registers** at `/register` (dynamic client registration) → receives our YNAB `client_id` back
4. Client opens browser to our `/authorize` → server redirects to `https://app.ynab.com/oauth/authorize` with YNAB `client_id`, PKCE challenge, and client's `redirect_uri`
5. User logs in to YNAB and approves → YNAB redirects to client's `redirect_uri` with authorization `code`
6. Client POSTs code to our `/token` → server proxies to `https://api.youneedabudget.com/oauth/token`, adding our `client_secret`
7. Client receives **YNAB access token** (expires 2 hours) + **refresh token** (long-lived)
8. All future `/mcp` requests include `Authorization: Bearer <ynab_access_token>`
9. Server verifies token via `GET https://api.youneedabudget.com/v1/user`; uses it directly to call YNAB API

**Refresh:** When the access token expires, Claude Desktop silently calls our `/token` with `grant_type=refresh_token`. The server proxies to YNAB and returns a new access token. No user interaction required.

**Re-authentication required only if:** access is revoked in YNAB, or the user clears Claude Desktop's stored credentials.

---

## Components

### `src/auth.ts` (new)

- **`InMemoryClientsStore`** — stores MCP clients registered via dynamic client registration. All clients receive our YNAB `client_id` back. Redirect URIs are accumulated in memory (reset on restart; clients re-register automatically on reconnect).
- **`verifyAccessToken(token)`** — calls `GET https://api.youneedabudget.com/v1/user` with the Bearer token. Returns `AuthInfo` on success, throws on 401.
- **`oauthProvider`** — `ProxyOAuthServerProvider` instance configured with YNAB endpoints, `verifyAccessToken`, and the client store's `getClient`.

### `src/client.ts` (updated)

Remove the env-var singleton. Replace with:

```ts
export function getClient(token: string): ynab.API {
  return new ynab.API(token);
}
```

No caching needed — `ynab.API` construction is cheap and each request is short-lived.

### `src/tools/*.ts` (updated — all 7 files)

Change `register(server: McpServer)` → `register(server: McpServer, token: string)`.

Each tool's handler calls `getClient(token)` instead of `getClient()`.

### `src/index.ts` (updated)

Replace raw `node:http` with Express:

```
app.use(express.json())
app.use(mcpAuthRouter({ provider: oauthProvider, issuerUrl, ... }))
app.post('/mcp', requireBearerAuth({ provider: oauthProvider }), mcpHandler)
app.get('/mcp', requireBearerAuth({ provider: oauthProvider }), mcpHandler)  // SSE
```

`mcpHandler` creates a `StreamableHTTPServerTransport` + `McpServer(token)` per request, connects them, handles the request, then closes.

---

## Environment Variables

| Variable | Description |
|---|---|
| `YNAB_CLIENT_ID` | Client ID from YNAB OAuth app settings |
| `YNAB_CLIENT_SECRET` | Client secret from YNAB OAuth app settings |
| `SERVER_URL` | `https://ynab-mcp-production-826d.up.railway.app` |
| `PORT` | Set automatically by Railway |

**Remove:** `YNAB_API_TOKEN`

---

## YNAB OAuth App Configuration

In [app.ynab.com/oauth/applications](https://app.ynab.com/oauth/applications), the redirect URI must include `http://localhost` to support Claude Desktop's loopback callback (YNAB honours RFC 8252 port-relaxation for loopback URIs, so any port is accepted).

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Missing/invalid Bearer token | `requireBearerAuth` returns 401 automatically |
| YNAB token expired | Client refreshes via `/token`; transparent to user |
| YNAB API error in a tool | Tool returns error message in MCP response |
| Missing env vars at startup | Server logs error and exits with code 1 |

---

## What Is Not Changing

- All 7 YNAB tool implementations (logic unchanged, only `register` signature)
- Stdio mode for local Claude Desktop is removed — HTTP + OAuth is now the only supported transport
- Railway deployment infrastructure

---

## Out of Scope

- Token caching / YNAB API response caching
- User management or per-user rate limiting
- Revoking tokens from the MCP server side (users revoke in YNAB directly)
