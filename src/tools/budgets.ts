import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

export async function listBudgets(args: { include_accounts?: boolean }) {
  const client = getClient();
  const response = await client.budgets.getBudgets(args.include_accounts);
  return response.data;
}

export async function getBudget(args: {
  budget_id?: string;
  last_knowledge_of_server?: number;
}) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.budgets.getBudgetById(budgetId, args.last_knowledge_of_server);
  return response.data;
}

export function register(server: McpServer): void {
  server.tool(
    "list_budgets",
    "List all budgets accessible to the authenticated user.",
    { include_accounts: z.boolean().optional().describe("Include account details for each budget.") },
    (args) => wrapHandler(() => listBudgets(args))
  );

  server.tool(
    "get_budget",
    "Get a single budget by ID, including settings and currency format.",
    { budget_id: budgetIdSchema, last_knowledge_of_server: lastKnowledgeSchema },
    (args) => wrapHandler(() => getBudget(args))
  );
}
