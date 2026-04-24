import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

export async function listCategories(args: {
  budget_id?: string;
  last_knowledge_of_server?: number;
}) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.categories.getCategories(budgetId, args.last_knowledge_of_server);
  return response.data;
}

export async function getCategory(args: { budget_id?: string; category_id: string }) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.categories.getCategoryById(budgetId, args.category_id);
  return response.data;
}

export async function updateCategoryBudget(args: {
  budget_id?: string;
  month: string;
  category_id: string;
  budgeted: number;
}) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.categories.updateMonthCategory(
    budgetId,
    args.month,
    args.category_id,
    { category: { budgeted: args.budgeted } }
  );
  return response.data;
}

export function register(server: McpServer): void {
  server.tool(
    "list_categories",
    "List all category groups and their categories for a budget.",
    { budget_id: budgetIdSchema, last_knowledge_of_server: lastKnowledgeSchema },
    (args) => wrapHandler(() => listCategories(args))
  );

  server.tool(
    "get_category",
    "Get a single category by ID.",
    {
      budget_id: budgetIdSchema,
      category_id: z.string().describe("The category ID."),
    },
    (args) => wrapHandler(() => getCategory(args))
  );

  server.tool(
    "update_category_budget",
    "Set the budgeted amount for a category in a specific month. Amounts are in milliunits (1000 = $1.00).",
    {
      budget_id: budgetIdSchema,
      month: z
        .string()
        .describe("The month in YYYY-MM-DD format, or 'current' for the current month."),
      category_id: z.string().describe("The category ID."),
      budgeted: z.number().int().describe("Budgeted amount in milliunits (1000 = $1.00)."),
    },
    (args) => wrapHandler(() => updateCategoryBudget(args))
  );
}
