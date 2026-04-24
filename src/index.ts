import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { register as registerBudgets } from "./tools/budgets.js";
import { register as registerAccounts } from "./tools/accounts.js";
import { register as registerCategories } from "./tools/categories.js";
import { register as registerPayees } from "./tools/payees.js";
import { register as registerTransactions } from "./tools/transactions.js";
import { register as registerScheduledTransactions } from "./tools/scheduled_transactions.js";
import { register as registerMonths } from "./tools/months.js";

const server = new McpServer({
  name: "ynab-mcp",
  version: "1.0.0",
});

registerBudgets(server);
registerAccounts(server);
registerCategories(server);
registerPayees(server);
registerTransactions(server);
registerScheduledTransactions(server);
registerMonths(server);

const transport = new StdioServerTransport();
await server.connect(transport);
