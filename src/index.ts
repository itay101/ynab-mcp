import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { register as registerBudgets } from "./tools/budgets.js";
import { register as registerAccounts } from "./tools/accounts.js";
import { register as registerCategories } from "./tools/categories.js";
import { register as registerPayees } from "./tools/payees.js";
import { register as registerTransactions } from "./tools/transactions.js";
import { register as registerScheduledTransactions } from "./tools/scheduled_transactions.js";
import { register as registerMonths } from "./tools/months.js";

function createMcpServer(token: string) {
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

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : undefined);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

if (process.env.PORT) {
  // HTTP mode for Railway / remote deployments
  const port = parseInt(process.env.PORT, 10);

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const authHeader = req.headers["authorization"] ?? "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!token) {
        res.writeHead(401).end(JSON.stringify({ error: "Missing Bearer token" }));
        return;
      }
      const body = req.method === "POST" ? await readBody(req) : undefined;
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = createMcpServer(token);
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
      res.on("finish", () => server.close());
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }
  });

  httpServer.listen(port, () => {
    console.log(`ynab-mcp listening on port ${port}`);
  });
} else {
  // Stdio mode for local Claude Desktop / CLI usage
  const token = process.env.YNAB_API_TOKEN ?? "";
  const server = createMcpServer(token);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
