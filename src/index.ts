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

function createMcpServer() {
  const server = new McpServer({ name: "ynab-mcp", version: "1.0.0" });
  registerBudgets(server);
  registerAccounts(server);
  registerCategories(server);
  registerPayees(server);
  registerTransactions(server);
  registerScheduledTransactions(server);
  registerMonths(server);
  return server;
}

if (process.env.PORT) {
  // HTTP mode for Railway / remote deployments
  const port = parseInt(process.env.PORT, 10);

  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  httpServer.listen(port, () => {
    console.log(`ynab-mcp listening on port ${port}`);
  });
} else {
  // Stdio mode for local Claude Desktop / CLI usage
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
