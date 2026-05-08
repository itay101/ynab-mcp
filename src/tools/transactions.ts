import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../client.js";
import { budgetIdSchema, lastKnowledgeSchema } from "../schemas.js";
import { wrapHandler } from "../utils.js";

const clearedEnum = z
  .enum(["cleared", "uncleared", "reconciled"])
  .optional()
  .describe("Cleared status of the transaction.");

const flagColorEnum = z
  .enum(["red", "orange", "yellow", "green", "blue", "purple"])
  .optional()
  .describe("Flag color.");

const transactionTypeEnum = z
  .enum(["uncategorized", "unapproved"])
  .optional()
  .describe("Filter transactions by type.");

const sinceDateSchema = z
  .string()
  .optional()
  .describe("Return transactions on or after this date (YYYY-MM-DD).");

export async function listTransactions(
  args: {
    budget_id?: string;
    since_date?: string;
    type?: "uncategorized" | "unapproved";
    last_knowledge_of_server?: number;
  },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.getTransactions(
    budgetId,
    args.since_date,
    args.type,
    args.last_knowledge_of_server
  );
  return response.data;
}

export async function getTransaction(
  args: { budget_id?: string; transaction_id: string },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.getTransactionById(budgetId, args.transaction_id);
  return response.data;
}

export async function createTransaction(
  args: {
    budget_id?: string;
    account_id: string;
    date: string;
    amount: number;
    payee_id?: string;
    payee_name?: string;
    category_id?: string;
    memo?: string;
    cleared?: "cleared" | "uncleared" | "reconciled";
    approved?: boolean;
    flag_color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple";
    import_id?: string;
  },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.createTransaction(budgetId, {
    transaction: {
      account_id: args.account_id,
      date: args.date,
      amount: args.amount,
      payee_id: args.payee_id,
      payee_name: args.payee_name,
      category_id: args.category_id,
      memo: args.memo,
      cleared: args.cleared,
      approved: args.approved,
      flag_color: args.flag_color,
      import_id: args.import_id,
    },
  });
  return response.data;
}

export async function updateTransaction(
  args: {
    budget_id?: string;
    transaction_id: string;
    account_id: string;
    date: string;
    amount: number;
    payee_id?: string;
    payee_name?: string;
    category_id?: string;
    memo?: string;
    cleared?: "cleared" | "uncleared" | "reconciled";
    approved?: boolean;
    flag_color?: "red" | "orange" | "yellow" | "green" | "blue" | "purple";
  },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.updateTransaction(budgetId, args.transaction_id, {
    transaction: {
      account_id: args.account_id,
      date: args.date,
      amount: args.amount,
      payee_id: args.payee_id,
      payee_name: args.payee_name,
      category_id: args.category_id,
      memo: args.memo,
      cleared: args.cleared,
      approved: args.approved,
      flag_color: args.flag_color,
    },
  });
  return response.data;
}

export async function deleteTransaction(
  args: { budget_id?: string; transaction_id: string },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.deleteTransaction(budgetId, args.transaction_id);
  return response.data;
}

export async function bulkCreateTransactions(
  args: {
    budget_id?: string;
    transactions: Array<{
      account_id: string;
      date: string;
      amount: number;
      payee_id?: string;
      payee_name?: string;
      category_id?: string;
      memo?: string;
      cleared?: string;
      approved?: boolean;
      flag_color?: string;
      import_id?: string;
    }>;
  },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.createTransactions(budgetId, {
    transactions: args.transactions as any,
  });
  return response.data;
}

export async function listTransactionsByAccount(
  args: {
    budget_id?: string;
    account_id: string;
    since_date?: string;
    type?: "uncategorized" | "unapproved";
    last_knowledge_of_server?: number;
  },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.getTransactionsByAccount(
    budgetId,
    args.account_id,
    args.since_date,
    args.type,
    args.last_knowledge_of_server
  );
  return response.data;
}

export async function listTransactionsByCategory(
  args: {
    budget_id?: string;
    category_id: string;
    since_date?: string;
    type?: "uncategorized" | "unapproved";
    last_knowledge_of_server?: number;
  },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.getTransactionsByCategory(
    budgetId,
    args.category_id,
    args.since_date,
    args.type,
    args.last_knowledge_of_server
  );
  return response.data;
}

export async function listTransactionsByPayee(
  args: {
    budget_id?: string;
    payee_id: string;
    since_date?: string;
    type?: "uncategorized" | "unapproved";
    last_knowledge_of_server?: number;
  },
  token: string
) {
  const client = getClient(token);
  const budgetId = args.budget_id ?? "last-used";
  const response = await client.transactions.getTransactionsByPayee(
    budgetId,
    args.payee_id,
    args.since_date,
    args.type,
    args.last_knowledge_of_server
  );
  return response.data;
}

const transactionCreateSchema = {
  budget_id: budgetIdSchema,
  account_id: z.string().describe("The account ID to create the transaction in."),
  date: z.string().describe("Transaction date in YYYY-MM-DD format."),
  amount: z.number().int().describe("Amount in milliunits (negative = outflow, e.g. -15000 = -$15.00)."),
  payee_id: z.string().optional().describe("The payee ID."),
  payee_name: z.string().optional().describe("Payee name (creates a new payee if it does not exist)."),
  category_id: z.string().optional().describe("The category ID."),
  memo: z.string().optional().describe("Memo/notes for the transaction."),
  cleared: clearedEnum,
  approved: z.boolean().optional().describe("Whether the transaction is approved."),
  flag_color: flagColorEnum,
  import_id: z.string().optional().describe("Import ID for idempotent imports."),
};

export function register(server: McpServer, token: string): void {
  server.tool(
    "list_transactions",
    "List transactions for a budget. Optionally filter by date or type.",
    {
      budget_id: budgetIdSchema,
      since_date: sinceDateSchema,
      type: transactionTypeEnum,
      last_knowledge_of_server: lastKnowledgeSchema,
    },
    (args) => wrapHandler(() => listTransactions(args, token))
  );

  server.tool(
    "get_transaction",
    "Get a single transaction by ID.",
    {
      budget_id: budgetIdSchema,
      transaction_id: z.string().describe("The transaction ID."),
    },
    (args) => wrapHandler(() => getTransaction(args, token))
  );

  server.tool(
    "create_transaction",
    "Create a new transaction. Amounts are in milliunits (1000 = $1.00; use negative for outflows).",
    transactionCreateSchema,
    (args) => wrapHandler(() => createTransaction(args, token))
  );

  server.tool(
    "update_transaction",
    "Update an existing transaction. Amounts are in milliunits (1000 = $1.00). Note: account_id, date, and amount are required even for partial updates — the YNAB API replaces the full transaction.",
    {
      ...transactionCreateSchema,
      transaction_id: z.string().describe("The transaction ID to update."),
    },
    (args) => wrapHandler(() => updateTransaction(args, token))
  );

  server.tool(
    "delete_transaction",
    "Delete a transaction by ID.",
    {
      budget_id: budgetIdSchema,
      transaction_id: z.string().describe("The transaction ID to delete."),
    },
    (args) => wrapHandler(() => deleteTransaction(args, token))
  );

  server.tool(
    "bulk_create_transactions",
    "Create multiple transactions at once. Amounts are in milliunits (1000 = $1.00).",
    {
      budget_id: budgetIdSchema,
      transactions: z
        .array(
          z.object({
            account_id: z.string(),
            date: z.string().describe("YYYY-MM-DD"),
            amount: z.number().int().describe("Milliunits"),
            payee_id: z.string().optional(),
            payee_name: z.string().optional(),
            category_id: z.string().optional(),
            memo: z.string().optional(),
            cleared: z.enum(["cleared", "uncleared", "reconciled"]).optional(),
            approved: z.boolean().optional(),
            flag_color: z.enum(["red", "orange", "yellow", "green", "blue", "purple"]).optional(),
            import_id: z.string().optional(),
          })
        )
        .describe("Array of transactions to create."),
    },
    (args) => wrapHandler(() => bulkCreateTransactions(args, token))
  );

  server.tool(
    "list_transactions_by_account",
    "List transactions for a specific account.",
    {
      budget_id: budgetIdSchema,
      account_id: z.string().describe("The account ID."),
      since_date: sinceDateSchema,
      type: transactionTypeEnum,
      last_knowledge_of_server: lastKnowledgeSchema,
    },
    (args) => wrapHandler(() => listTransactionsByAccount(args, token))
  );

  server.tool(
    "list_transactions_by_category",
    "List transactions for a specific category.",
    {
      budget_id: budgetIdSchema,
      category_id: z.string().describe("The category ID."),
      since_date: sinceDateSchema,
      type: transactionTypeEnum,
      last_knowledge_of_server: lastKnowledgeSchema,
    },
    (args) => wrapHandler(() => listTransactionsByCategory(args, token))
  );

  server.tool(
    "list_transactions_by_payee",
    "List transactions for a specific payee.",
    {
      budget_id: budgetIdSchema,
      payee_id: z.string().describe("The payee ID."),
      since_date: sinceDateSchema,
      type: transactionTypeEnum,
      last_knowledge_of_server: lastKnowledgeSchema,
    },
    (args) => wrapHandler(() => listTransactionsByPayee(args, token))
  );
}
