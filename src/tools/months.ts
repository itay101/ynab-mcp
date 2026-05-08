import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

export async function listBudgetMonths(
  args: { budget_id?: string; last_knowledge_of_server?: number },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.months.getBudgetMonths(budgetId, args.last_knowledge_of_server);
  return response.data;
}

export async function getBudgetMonth(
  args: { budget_id?: string; month: string },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.months.getBudgetMonth(budgetId, args.month);
  return response.data;
}

export function register(server: McpServer, token: string): void {
  server.tool(
    "list_budget_months",
    "List all budget months for a budget, showing monthly income, budgeted, and spending totals.",
    { budget_id: budgetIdSchema, last_knowledge_of_server: lastKnowledgeSchema },
    (args) => wrapHandler(() => listBudgetMonths(args, token))
  );

  server.tool(
    "get_budget_month",
    "Get details for a single budget month, including all category amounts for that month.",
    {
      budget_id: budgetIdSchema,
      month: z
        .string()
        .describe(
          "The budget month in YYYY-MM-DD format (day must be 01), or 'current' for the current month."
        ),
    },
    (args) => wrapHandler(() => getBudgetMonth(args, token))
  );
}
