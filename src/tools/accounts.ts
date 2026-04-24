import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

export async function listAccounts(args: {
  budget_id?: string;
  last_knowledge_of_server?: number;
}) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.accounts.getAccounts(budgetId, args.last_knowledge_of_server);
  return response.data;
}

export async function getAccount(args: { budget_id?: string; account_id: string }) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.accounts.getAccountById(budgetId, args.account_id);
  return response.data;
}

export function register(server: McpServer): void {
  server.tool(
    "list_accounts",
    "List all accounts in a budget.",
    { budget_id: budgetIdSchema, last_knowledge_of_server: lastKnowledgeSchema },
    (args) => wrapHandler(() => listAccounts(args))
  );

  server.tool(
    "get_account",
    "Get a single account by ID.",
    {
      budget_id: budgetIdSchema,
      account_id: z.string().describe("The account ID."),
    },
    (args) => wrapHandler(() => getAccount(args))
  );
}
