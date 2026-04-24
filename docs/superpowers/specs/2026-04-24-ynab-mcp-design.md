# YNAB MCP Server — Design Spec

**Date:** 2026-04-24

## Overview

A Model Context Protocol (MCP) server that exposes the full YNAB (You Need A Budget) API as tools, enabling LLMs to read and manage budgets, accounts, categories, transactions, and more.

## Architecture

**Approach:** Thin wrapper over the official `ynab` npm SDK. Each MCP tool directly calls the SDK. No intermediate service/abstraction layer.

**Runtime:** TypeScript (Node.js)

**Authentication:** Single personal access token read from `YNAB_API_TOKEN` environment variable at startup. Missing token causes immediate hard exit with a clear error message.

**Multi-budget support:** All budget-scoped tools accept an optional `budget_id` parameter, defaulting to `"last-used"` (a YNAB API special value that resolves to the most recently accessed budget).

## Project Structure

```
ynab-mcp/
├── src/
│   ├── index.ts                       # MCP server entry point — aggregates all tools
│   ├── client.ts                      # YNAB SDK client singleton
│   └── tools/
│       ├── budgets.ts                 # list_budgets, get_budget
│       ├── accounts.ts                # list_accounts, get_account
│       ├── categories.ts              # list_categories, get_category, update_category_budget
│       ├── payees.ts                  # list_payees, get_payee, list_payee_locations, get_payee_location
│       ├── transactions.ts            # list_transactions, get_transaction, create_transaction,
│       │                              # update_transaction, delete_transaction, bulk_create_transactions,
│       │                              # list_transactions_by_account, list_transactions_by_category,
│       │                              # list_transactions_by_payee
│       ├── scheduled_transactions.ts  # list_scheduled_transactions, get_scheduled_transaction,
│       │                              # create_scheduled_transaction, update_scheduled_transaction,
│       │                              # delete_scheduled_transaction
│       └── months.ts                  # list_budget_months, get_budget_month
├── package.json
└── tsconfig.json
```

Each `tools/*.ts` file exports:
- An array of MCP tool definitions (name, description, JSON input schema)
- A handler map: `{ [toolName]: (args) => Promise<result> }`

`index.ts` aggregates all tool definitions and handler maps into a single MCP server instance using `@modelcontextprotocol/sdk`.

## Tool Inventory (~24 tools)

| Resource | Tools |
|---|---|
| Budgets | `list_budgets`, `get_budget` |
| Accounts | `list_accounts`, `get_account` |
| Categories | `list_categories`, `get_category`, `update_category_budget` (sets the budgeted amount for a category in a specific month) |
| Payees | `list_payees`, `get_payee`, `list_payee_locations`, `get_payee_location` |
| Transactions | `list_transactions`, `get_transaction`, `create_transaction`, `update_transaction`, `delete_transaction`, `bulk_create_transactions`, `list_transactions_by_account`, `list_transactions_by_category`, `list_transactions_by_payee` |
| Scheduled Transactions | `list_scheduled_transactions`, `get_scheduled_transaction`, `create_scheduled_transaction`, `update_scheduled_transaction`, `delete_scheduled_transaction` |
| Budget Months | `list_budget_months`, `get_budget_month` |

## Data Conventions

**Amounts (milliunits):** YNAB represents all monetary amounts as integers in milliunits, where 1000 = $1.00. All tool descriptions and parameter schemas document this explicitly. No automatic conversion is performed — the server passes milliunits to/from the API as-is.

**Response format:** Tools return the raw JSON-serialized SDK response. No custom mapping or transformation is applied.

## Error Handling

- YNAB SDK errors (typed, include a `detail` field) are caught per-handler and returned as MCP error responses with a human-readable message.
- Missing `YNAB_API_TOKEN` at startup: hard exit with a clear error message before the server starts.
- No silent swallowing of errors — all failures surface to the caller.

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `ynab` — official YNAB JavaScript SDK
- `typescript`, `tsx` or `ts-node` — TypeScript execution
- `zod` — input validation and schema definition for tool parameters
