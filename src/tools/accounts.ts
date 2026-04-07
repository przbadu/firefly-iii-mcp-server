/**
 * Account tools for Firefly III MCP server.
 *
 * Covers: create, list, get, update, and delete accounts.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../services/api-client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

const AccountTypeEnum = z.enum([
  "asset",
  "expense",
  "revenue",
  "cash",
  "liability",
  "liabilities",
  "initial-balance",
  "reconciliation",
]).describe("Account type");

const AccountRoleEnum = z.enum([
  "defaultAsset",
  "sharedAsset",
  "savingAsset",
  "ccAsset",
  "cashWalletAsset",
]).optional().describe("Account role (only for asset accounts)");

const CreateAccountSchema = z.object({
  name: z.string().min(1).describe("Account name"),
  type: AccountTypeEnum,
  currency_code: z.string().optional().describe("Currency code (e.g. 'USD'). Defaults to system default."),
  account_role: AccountRoleEnum,
  opening_balance: z.string().optional().describe("Opening balance as string, e.g. '1000.00'"),
  opening_balance_date: z.string().optional().describe("Opening balance date (YYYY-MM-DD)"),
  notes: z.string().optional().describe("Notes"),
  iban: z.string().optional().describe("IBAN number"),
  account_number: z.string().optional().describe("Account number"),
  active: z.boolean().optional().default(true).describe("Whether the account is active"),
  include_net_worth: z.boolean().optional().default(true).describe("Include in net worth calculations"),
}).strict();

const ListAccountsSchema = z.object({
  type: AccountTypeEnum.optional().describe("Filter by account type"),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  page: z.number().int().min(1).default(1).describe("Page number"),
}).strict();

const GetAccountSchema = z.object({
  id: z.string().describe("Account ID"),
}).strict();

const UpdateAccountSchema = z.object({
  id: z.string().describe("Account ID to update"),
  name: z.string().optional().describe("Updated name"),
  active: z.boolean().optional().describe("Active status"),
  account_role: AccountRoleEnum,
  notes: z.string().optional().describe("Updated notes"),
  currency_code: z.string().optional().describe("Updated currency code"),
}).strict();

const DeleteAccountSchema = z.object({
  id: z.string().describe("Account ID to delete"),
}).strict();

// ── Helpers ──────────────────────────────────────────────────────────────────

interface FireflyAccount {
  id: string;
  attributes: {
    name: string;
    type: string;
    active: boolean;
    current_balance: string;
    currency_code: string;
    currency_symbol: string;
    account_role: string | null;
    notes: string | null;
    iban: string | null;
    account_number: string | null;
    include_net_worth: boolean;
  };
}

function formatAccount(acc: FireflyAccount): string {
  const a = acc.attributes;
  const lines = [
    `## ${a.name} (ID: ${acc.id})`,
    `- Type: ${a.type}${a.account_role ? ` (${a.account_role})` : ""}`,
    `- Balance: ${a.currency_symbol}${a.current_balance} ${a.currency_code}`,
    `- Active: ${a.active ? "Yes" : "No"}`,
  ];
  if (a.iban) lines.push(`- IBAN: ${a.iban}`);
  if (a.account_number) lines.push(`- Account #: ${a.account_number}`);
  if (a.notes) lines.push(`- Notes: ${a.notes}`);
  return lines.join("\n");
}

// ── Tool Registration ────────────────────────────────────────────────────────

export function registerAccountTools(server: McpServer): void {

  server.registerTool(
    "firefly_create_account",
    {
      title: "Create Firefly III Account",
      description: `Create a new account in Firefly III.

Account types: asset (bank accounts, wallets), expense (stores, services), revenue (employers, income sources), liability (loans, mortgages), cash.

For asset accounts, specify a role: defaultAsset, sharedAsset, savingAsset, ccAsset (credit card), cashWalletAsset.`,
      inputSchema: CreateAccountSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await apiRequest<{ data: FireflyAccount }>("/accounts", "POST", params);
        return {
          content: [{ type: "text" as const, text: `Account created!\n\n${formatAccount(result.data)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "firefly_list_accounts",
    {
      title: "List Firefly III Accounts",
      description: `List accounts with optional type filter. Returns account names, balances, and types.`,
      inputSchema: ListAccountsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const queryParams: Record<string, unknown> = { limit: params.limit, page: params.page };
        if (params.type) queryParams.type = params.type;

        const result = await apiRequest<{
          data: FireflyAccount[];
          meta: { pagination: { total: number; current_page: number; total_pages: number } };
        }>("/accounts", "GET", undefined, queryParams);

        const { data, meta } = result;
        if (!data.length) {
          return { content: [{ type: "text" as const, text: "No accounts found." }] };
        }

        let text = `# Accounts (Page ${meta.pagination.current_page}/${meta.pagination.total_pages}, ${meta.pagination.total} total)\n\n`;
        for (const acc of data) {
          text += formatAccount(acc) + "\n\n";
          if (text.length > CHARACTER_LIMIT) {
            text += `\n*Truncated. Use pagination to see more.*`;
            break;
          }
        }
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "firefly_get_account",
    {
      title: "Get Firefly III Account",
      description: `Get a single account by ID with full details.`,
      inputSchema: GetAccountSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await apiRequest<{ data: FireflyAccount }>(`/accounts/${params.id}`);
        return { content: [{ type: "text" as const, text: formatAccount(result.data) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "firefly_update_account",
    {
      title: "Update Firefly III Account",
      description: `Update an existing account. Only provide fields you want to change.`,
      inputSchema: UpdateAccountSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const { id, ...updates } = params;
        const result = await apiRequest<{ data: FireflyAccount }>(`/accounts/${id}`, "PUT", updates);
        return {
          content: [{ type: "text" as const, text: `Account updated!\n\n${formatAccount(result.data)}` }],
        };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "firefly_delete_account",
    {
      title: "Delete Firefly III Account",
      description: `Permanently delete an account. All linked transactions will also be deleted. This cannot be undone.`,
      inputSchema: DeleteAccountSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`/accounts/${params.id}`, "DELETE");
        return { content: [{ type: "text" as const, text: `Account ${params.id} deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
