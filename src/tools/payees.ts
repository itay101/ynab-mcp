import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

export async function listPayees(args: {
  budget_id?: string;
  last_knowledge_of_server?: number;
}) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.payees.getPayees(budgetId, args.last_knowledge_of_server);
  return response.data;
}

export async function getPayee(args: { budget_id?: string; payee_id: string }) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.payees.getPayeeById(budgetId, args.payee_id);
  return response.data;
}

export async function listPayeeLocations(args: { budget_id?: string }) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.payeeLocations.getPayeeLocations(budgetId);
  return response.data;
}

export async function getPayeeLocation(args: { budget_id?: string; payee_id: string }) {
  const client = getClient();
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.payeeLocations.getPayeeLocationsByPayee(budgetId, args.payee_id);
  return response.data;
}

export function register(server: McpServer): void {
  server.tool(
    "list_payees",
    "List all payees in a budget.",
    { budget_id: budgetIdSchema, last_knowledge_of_server: lastKnowledgeSchema },
    (args) => wrapHandler(() => listPayees(args))
  );

  server.tool(
    "get_payee",
    "Get a single payee by ID.",
    {
      budget_id: budgetIdSchema,
      payee_id: z.string().describe("The payee ID."),
    },
    (args) => wrapHandler(() => getPayee(args))
  );

  server.tool(
    "list_payee_locations",
    "List all payee locations in a budget (geographic coordinates for payees).",
    { budget_id: budgetIdSchema },
    (args) => wrapHandler(() => listPayeeLocations(args))
  );

  server.tool(
    "get_payee_location",
    "Get all geographic locations associated with a specific payee.",
    {
      budget_id: budgetIdSchema,
      payee_id: z.string().describe("The payee ID."),
    },
    (args) => wrapHandler(() => getPayeeLocation(args))
  );
}
