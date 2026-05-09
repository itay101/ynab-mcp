import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
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

interface RegisteredClient {
  client: OAuthClientInformationFull;
  expiresAt: number;
}

export class YNABOAuthProvider implements OAuthServerProvider {
  private readonly ynabClientId: string;
  private readonly ynabClientSecret: string;
  private readonly callbackUrl: string;
  private readonly _clientsFile: string | null;

  private readonly _clients = new Map<string, RegisteredClient>();
  private readonly _pendingAuths = new Map<string, PendingAuth>();
  private readonly _pendingCodes = new Map<string, PendingCode>();
  private readonly _cleanupTimer: ReturnType<typeof setInterval>;

  constructor(ynabClientId: string, ynabClientSecret: string, serverUrl: string, clientsFile?: string) {
    this.ynabClientId = ynabClientId;
    this.ynabClientSecret = ynabClientSecret;
    this.callbackUrl = `${serverUrl}/oauth/callback`;
    this._clientsFile = clientsFile ?? null;
    if (this._clientsFile) this._loadClients();
    this._cleanupTimer = setInterval(() => this._cleanupExpired(), 10 * 60 * 1000);
    this._cleanupTimer.unref();
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId: string) => this._clients.get(clientId)?.client,
      registerClient: (clientData) => {
        for (const uri of clientData.redirect_uris) {
          const { hostname } = new URL(uri);
          if (hostname !== "localhost" && hostname !== "127.0.0.1") {
            throw new Error(`Redirect URI must use localhost: ${uri}`);
          }
        }
        const clientId = randomUUID();
        const client: OAuthClientInformationFull = {
          ...clientData,
          client_id: clientId,
          client_id_issued_at: Math.floor(Date.now() / 1000),
        };
        this._clients.set(clientId, {
          client,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });
        this._saveClients();
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
    this._cleanupExpired();
    const pending = this._pendingCodes.get(code);
    if (!pending) throw new Error("Authorization code not found or expired");
    return pending.codeChallenge;
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
    let clientsChanged = false;
    for (const [k, v] of this._clients) {
      if (now > v.expiresAt) {
        this._clients.delete(k);
        clientsChanged = true;
      }
    }
    if (clientsChanged) this._saveClients();
  }

  private _loadClients(): void {
    try {
      const raw = readFileSync(this._clientsFile!, "utf8");
      const data = JSON.parse(raw) as Record<string, RegisteredClient>;
      const now = Date.now();
      for (const [id, entry] of Object.entries(data)) {
        if (entry.expiresAt > now) this._clients.set(id, entry);
      }
    } catch {
      // File missing or corrupt — start with empty map
    }
  }

  private _saveClients(): void {
    if (!this._clientsFile) return;
    try {
      writeFileSync(this._clientsFile, JSON.stringify(Object.fromEntries(this._clients)), "utf8");
    } catch {
      // Best-effort — don't crash if write fails
    }
  }
}
