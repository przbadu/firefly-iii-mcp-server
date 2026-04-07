/**
 * Transaction tools for Firefly III MCP server.
 *
 * Covers: create, list, get, update, and delete transactions.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../services/api-client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const TransactionTypeEnum = z.enum([
  "withdrawal",
  "deposit",
  "transfer",
  "reconciliation",
  "opening-balance",
]).describe("Transaction type");

const TransactionSplitSchema = z.object({
  amount: z.string().describe("Transaction amount as a string, e.g. '25.50'"),
  description: z.string().min(1).describe("Description of this split"),
  source_name: z.string().optional().describe("Source account name (required for withdrawals)"),
  source_id: z.string().optional().describe("Source account ID (alternative to source_name)"),
  destination_name: z.string().optional().describe("Destination account name (required for deposits)"),
  destination_id: z.string().optional().describe("Destination account ID (alternative to destination_name)"),
  category_name: z.string().optional().describe("Category name"),
  budget_name: z.string().optional().describe("Budget name"),
  tags: z.array(z.string()).optional().describe("Tags to attach"),
  notes: z.string().optional().describe("Additional notes"),
  currency_code: z.string().optional().describe("Currency code, e.g. 'USD', 'EUR'"),
  foreign_amount: z.string().optional().describe("Foreign currency amount"),
  foreign_currency_code: z.string().optional().describe("Foreign currency code"),
});

const CreateTransactionSchema = z.object({
  type: TransactionTypeEnum,
  description: z.string().min(1).describe("Main transaction description"),
  date: z.string().describe("Transaction date in YYYY-MM-DD format"),
  amount: z.string().describe("Transaction amount as a string, e.g. '25.50'"),
  source_name: z.string().optional().describe("Source account name (required for withdrawals/transfers)"),
  source_id: z.string().optional().describe("Source account ID (alternative to source_name)"),
  destination_name: z.string().optional().describe("Destination account name (required for deposits/transfers). For withdrawals this is the expense account (e.g. 'Grocery Store')."),
  destination_id: z.string().optional().describe("Destination account ID (alternative to destination_name)"),
  category_name: z.string().optional().describe("Category name (e.g. 'Groceries')"),
  budget_name: z.string().optional().describe("Budget name"),
  tags: z.array(z.string()).optional().describe("Tags to attach"),
  notes: z.string().optional().describe("Additional notes"),
  currency_code: z.string().optional().describe("Currency code, e.g. 'USD', 'EUR'. Defaults to account default."),
  splits: z.array(TransactionSplitSchema).optional().describe("For split transactions, provide multiple splits instead of top-level amount/source/destination"),
}).strict();

const ListTransactionsSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results to return"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  type: TransactionTypeEnum.optional().describe("Filter by transaction type"),
  start: z.string().optional().describe("Start date filter (YYYY-MM-DD)"),
  end: z.string().optional().describe("End date filter (YYYY-MM-DD)"),
}).strict();

const GetTransactionSchema = z.object({
  id: z.string().describe("Transaction group ID"),
}).strict();

const UpdateTransactionSchema = z.object({
  id: z.string().describe("Transaction group ID to update"),
  description: z.string().optional().describe("Updated description"),
  date: z.string().optional().describe("Updated date (YYYY-MM-DD)"),
  amount: z.string().optional().describe("Updated amount"),
  source_name: z.string().optional().describe("Updated source account name"),
  destination_name: z.string().optional().describe("Updated destination account name"),
  category_name: z.string().optional().describe("Updated category name"),
  budget_name: z.string().optional().describe("Updated budget name"),
  tags: z.array(z.string()).optional().describe("Updated tags"),
  notes: z.string().optional().describe("Updated notes"),
}).strict();

const DeleteTransactionSchema = z.object({
  id: z.string().describe("Transaction group ID to delete"),
}).strict();

const SearchTransactionsSchema = z.object({
  query: z.string().min(1).describe("Search query string. Supports Firefly III search syntax (e.g. 'description_contains:grocery', 'amount_more:50')"),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  page: z.number().int().min(1).default(1).describe("Page number"),
}).strict();

// ── Helpers ──────────────────────────────────────────────────────────────────

interface FireflyTransaction {
  id: string;
  attributes: {
    group_title: string | null;
    transactions: Array<{
      description: string;
      date: string;
      amount: string;
      type: string;
      source_name: string;
      destination_name: string;
      category_name: string | null;
      budget_name: string | null;
      tags: string[];
      notes: string | null;
      currency_code: string;
      currency_symbol: string;
    }>;
  };
}

function formatTransaction(tx: FireflyTransaction): string {
  const attrs = tx.attributes;
  const lines: string[] = [];
  const title = attrs.group_title || attrs.transactions[0]?.description || "Untitled";
  lines.push(`## ${title} (ID: ${tx.id})`);

  for (const split of attrs.transactions) {
    lines.push(`- **${split.type}**: ${split.currency_symbol}${split.amount}`);
    lines.push(`  ${split.source_name} → ${split.destination_name}`);
    lines.push(`  Date: ${split.date.slice(0, 10)}`);
    if (split.category_name) lines.push(`  Category: ${split.category_name}`);
    if (split.budget_name) lines.push(`  Budget: ${split.budget_name}`);
    if (split.tags?.length) lines.push(`  Tags: ${split.tags.join(", ")}`);
    if (split.notes) lines.push(`  Notes: ${split.notes}`);
  }
  return lines.join("\n");
}

// ── Tool Registration ────────────────────────────────────────────────────────

export function registerTransactionTools(server: McpServer): void {

  // ── Create Transaction ─────────────────────────────────────────────────────
  server.registerTool(
    "firefly_create_transaction",
    {
      title: "Create Firefly III Transaction",
      description: `Create a new transaction in Firefly III.

Supports withdrawals (expenses), deposits (income), and transfers between accounts.

For a withdrawal: provide source_name (your asset account, e.g. "Checking Account") and destination_name (the expense account, e.g. "Supermarket").
For a deposit: provide source_name (revenue account, e.g. "Employer") and destination_name (your asset account).
For a transfer: both source and destination should be your own asset accounts.

If an expense/revenue account doesn't exist yet, Firefly III will auto-create it.

Returns: The created transaction with its ID.`,
      inputSchema: CreateTransactionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        let transactions;

        if (params.splits && params.splits.length > 0) {
          transactions = params.splits.map((s) => ({
            type: params.type,
            date: params.date,
            ...s,
          }));
        } else {
          transactions = [
            {
              type: params.type,
              description: params.description,
              date: params.date,
              amount: params.amount,
              source_name: params.source_name,
              source_id: params.source_id,
              destination_name: params.destination_name,
              destination_id: params.destination_id,
              category_name: params.category_name,
              budget_name: params.budget_name,
              tags: params.tags,
              notes: params.notes,
              currency_code: params.currency_code,
            },
          ];
        }

        const result = await apiRequest<{ data: FireflyTransaction }>(
          "/transactions",
          "POST",
          {
            error_if_duplicate_hash: false,
            apply_rules: true,
            fire_webhooks: true,
            group_title: params.description,
            transactions,
          }
        );

        const tx = result.data;
        return {
          content: [
            {
              type: "text" as const,
              text: `Transaction created successfully!\n\n${formatTransaction(tx)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ── List Transactions ──────────────────────────────────────────────────────
  server.registerTool(
    "firefly_list_transactions",
    {
      title: "List Firefly III Transactions",
      description: `List transactions from Firefly III with optional filters.

Supports filtering by type (withdrawal, deposit, transfer), date range, and pagination.
Returns a paginated list of transactions with key details.`,
      inputSchema: ListTransactionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const queryParams: Record<string, unknown> = {
          limit: params.limit,
          page: params.page,
        };
        if (params.type) queryParams.type = params.type;
        if (params.start) queryParams.start = params.start;
        if (params.end) queryParams.end = params.end;

        const result = await apiRequest<{
          data: FireflyTransaction[];
          meta: { pagination: { total: number; count: number; per_page: number; current_page: number; total_pages: number } };
        }>("/transactions", "GET", undefined, queryParams);

        const { data, meta } = result;
        const pag = meta.pagination;

        if (!data.length) {
          return {
            content: [{ type: "text" as const, text: "No transactions found matching your filters." }],
          };
        }

        let text = `# Transactions (Page ${pag.current_page}/${pag.total_pages}, ${pag.total} total)\n\n`;
        for (const tx of data) {
          text += formatTransaction(tx) + "\n\n";
          if (text.length > CHARACTER_LIMIT) {
            text += `\n\n*Response truncated. Use pagination or narrow your date range to see more.*`;
            break;
          }
        }

        if (pag.current_page < pag.total_pages) {
          text += `\n---\nMore results available. Use page: ${pag.current_page + 1} to see the next page.`;
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ── Get Transaction ────────────────────────────────────────────────────────
  server.registerTool(
    "firefly_get_transaction",
    {
      title: "Get Firefly III Transaction",
      description: `Get a single transaction by its ID. Returns full details including all splits.`,
      inputSchema: GetTransactionSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await apiRequest<{ data: FireflyTransaction }>(
          `/transactions/${params.id}`
        );
        return {
          content: [{ type: "text" as const, text: formatTransaction(result.data) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ── Update Transaction ─────────────────────────────────────────────────────
  server.registerTool(
    "firefly_update_transaction",
    {
      title: "Update Firefly III Transaction",
      description: `Update an existing transaction. Only provide the fields you want to change.

First use firefly_get_transaction to retrieve the current values, then pass only the changed fields here.`,
      inputSchema: UpdateTransactionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const { id, ...updates } = params;

        // Build the transaction update — only include provided fields
        const txUpdate: Record<string, unknown> = {};
        if (updates.description !== undefined) txUpdate.description = updates.description;
        if (updates.date !== undefined) txUpdate.date = updates.date;
        if (updates.amount !== undefined) txUpdate.amount = updates.amount;
        if (updates.source_name !== undefined) txUpdate.source_name = updates.source_name;
        if (updates.destination_name !== undefined) txUpdate.destination_name = updates.destination_name;
        if (updates.category_name !== undefined) txUpdate.category_name = updates.category_name;
        if (updates.budget_name !== undefined) txUpdate.budget_name = updates.budget_name;
        if (updates.tags !== undefined) txUpdate.tags = updates.tags;
        if (updates.notes !== undefined) txUpdate.notes = updates.notes;

        const result = await apiRequest<{ data: FireflyTransaction }>(
          `/transactions/${id}`,
          "PUT",
          { transactions: [txUpdate] }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: `Transaction updated!\n\n${formatTransaction(result.data)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ── Delete Transaction ─────────────────────────────────────────────────────
  server.registerTool(
    "firefly_delete_transaction",
    {
      title: "Delete Firefly III Transaction",
      description: `Permanently delete a transaction by its ID. This action cannot be undone.`,
      inputSchema: DeleteTransactionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        await apiRequest(`/transactions/${params.id}`, "DELETE");
        return {
          content: [
            { type: "text" as const, text: `Transaction ${params.id} deleted successfully.` },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ── Search Transactions ────────────────────────────────────────────────────
  server.registerTool(
    "firefly_search_transactions",
    {
      title: "Search Firefly III Transactions",
      description: `Search transactions using Firefly III's query syntax.

Simple text searches match against description. Advanced syntax includes:
- description_contains:grocery
- amount_more:50
- amount_less:200
- date_after:2024-01-01
- date_before:2024-12-31
- category_is:Food
- tag_is:vacation
- source_account_is:Checking
- destination_account_is:Supermarket

Combine multiple filters with spaces.`,
      inputSchema: SearchTransactionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const result = await apiRequest<{
          data: FireflyTransaction[];
          meta: { pagination: { total: number; current_page: number; total_pages: number } };
        }>("/search/transactions", "GET", undefined, {
          query: params.query,
          limit: params.limit,
          page: params.page,
        });

        const { data, meta } = result;

        if (!data.length) {
          return {
            content: [
              { type: "text" as const, text: `No transactions found for query: "${params.query}"` },
            ],
          };
        }

        let text = `# Search Results for "${params.query}" (${meta.pagination.total} found)\n\n`;
        for (const tx of data) {
          text += formatTransaction(tx) + "\n\n";
          if (text.length > CHARACTER_LIMIT) {
            text += `\n*Truncated. Refine your search or use pagination.*`;
            break;
          }
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );
}
