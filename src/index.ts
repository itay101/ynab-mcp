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
  app.set("trust proxy", 1);
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
    console.log(`[mcp] ${req.method} auth=${!!req.auth} body=${JSON.stringify(req.body)?.slice(0, 100)}`);
    try {
      const token = req.auth!.token;
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = createMcpServer(token);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on("finish", () => server.close());
    } catch (err) {
      console.error("[mcp] handler error:", err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null });
      }
    }
  }

  app.post("/mcp", bearerAuth, mcpHandler);
  app.get("/mcp", bearerAuth, mcpHandler);
  app.delete("/mcp", bearerAuth, mcpHandler);

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
