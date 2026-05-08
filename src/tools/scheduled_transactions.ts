import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

const frequencyEnum = z
  .enum([
    "never",
    "daily",
    "weekly",
    "everyOtherWeek",
    "twiceAMonth",
    "every4Weeks",
    "monthly",
    "everyOtherMonth",
    "every3Months",
    "every4Months",
    "twiceAYear",
    "yearly",
    "everyOtherYear",
  ])
  .describe("How often the scheduled transaction repeats.");

type Frequency = z.infer<typeof frequencyEnum>;

export async function listScheduledTransactions(args: {
  budget_id?: string;
  last_knowledge_of_server?: number;
}, token?: string) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.scheduledTransactions.getScheduledTransactions(
    budgetId,
    args.last_knowledge_of_server
  );
  return response.data;
}

export async function getScheduledTransaction(args: {
  budget_id?: string;
  scheduled_transaction_id: string;
}, token?: string) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.scheduledTransactions.getScheduledTransactionById(
    budgetId,
    args.scheduled_transaction_id
  );
  return response.data;
}

export async function createScheduledTransaction(args: {
  budget_id?: string;
  account_id: string;
  date: string;
  amount: number;
  frequency: Frequency;
  payee_id?: string;
  payee_name?: string;
  category_id?: string;
  memo?: string;
  flag_color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple";
}, token?: string) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.scheduledTransactions.createScheduledTransaction(budgetId, {
    scheduled_transaction: {
      account_id: args.account_id,
      date: args.date,
      amount: args.amount,
      frequency: args.frequency,
      payee_id: args.payee_id,
      payee_name: args.payee_name,
      category_id: args.category_id,
      memo: args.memo,
      flag_color: args.flag_color,
    },
  });
  return response.data;
}

export async function updateScheduledTransaction(args: {
  budget_id?: string;
  scheduled_transaction_id: string;
  account_id: string;
  date: string;
  amount: number;
  frequency: Frequency;
  payee_id?: string;
  payee_name?: string;
  category_id?: string;
  memo?: string;
  flag_color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple";
}, token?: string) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.scheduledTransactions.updateScheduledTransaction(
    budgetId,
    args.scheduled_transaction_id,
    {
      scheduled_transaction: {
        account_id: args.account_id,
        date: args.date,
        amount: args.amount,
        frequency: args.frequency,
        payee_id: args.payee_id,
        payee_name: args.payee_name,
        category_id: args.category_id,
        memo: args.memo,
        flag_color: args.flag_color,
      },
    }
  );
  return response.data;
}

export async function deleteScheduledTransaction(args: {
  budget_id?: string;
  scheduled_transaction_id: string;
}, token?: string) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.scheduledTransactions.deleteScheduledTransaction(
    budgetId,
    args.scheduled_transaction_id
  );
  return response.data;
}

const scheduledTransactionBaseSchema = {
  budget_id: budgetIdSchema,
  account_id: z.string().describe("The account ID."),
  date: z.string().describe("First occurrence date in YYYY-MM-DD format."),
  amount: z
    .number()
    .int()
    .describe("Amount in milliunits (negative = outflow, e.g. -10000 = -$10.00)."),
  frequency: frequencyEnum,
  payee_id: z.string().optional().describe("The payee ID."),
  payee_name: z
    .string()
    .optional()
    .describe("Payee name (creates a new payee if it does not exist)."),
  category_id: z.string().optional().describe("The category ID."),
  memo: z.string().optional().describe("Memo/notes."),
  flag_color: z
    .enum(["red", "orange", "yellow", "green", "blue", "purple"])
    .optional()
    .describe("Flag color."),
};

export function register(server: McpServer, token?: string): void {
  server.tool(
    "list_scheduled_transactions",
    "List all scheduled transactions in a budget.",
    { budget_id: budgetIdSchema, last_knowledge_of_server: lastKnowledgeSchema },
    (args) => wrapHandler(() => listScheduledTransactions(args, token))
  );

  server.tool(
    "get_scheduled_transaction",
    "Get a single scheduled transaction by ID.",
    {
      budget_id: budgetIdSchema,
      scheduled_transaction_id: z.string().describe("The scheduled transaction ID."),
    },
    (args) => wrapHandler(() => getScheduledTransaction(args, token))
  );

  server.tool(
    "create_scheduled_transaction",
    "Create a new scheduled (recurring) transaction. Amounts are in milliunits (1000 = $1.00).",
    scheduledTransactionBaseSchema,
    (args) => wrapHandler(() => createScheduledTransaction(args, token))
  );

  server.tool(
    "update_scheduled_transaction",
    "Update an existing scheduled transaction. Amounts are in milliunits (1000 = $1.00).",
    {
      ...scheduledTransactionBaseSchema,
      scheduled_transaction_id: z.string().describe("The scheduled transaction ID to update."),
    },
    (args) => wrapHandler(() => updateScheduledTransaction(args, token))
  );

  server.tool(
    "delete_scheduled_transaction",
    "Delete a scheduled transaction by ID.",
    {
      budget_id: budgetIdSchema,
      scheduled_transaction_id: z.string().describe("The scheduled transaction ID to delete."),
    },
    (args) => wrapHandler(() => deleteScheduledTransaction(args, token))
  );
}
