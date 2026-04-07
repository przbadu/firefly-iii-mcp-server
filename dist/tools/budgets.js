/**
 * Budget tools for Firefly III MCP server.
 */
import { z } from "zod";
import { apiRequest, handleApiError } from "../services/api-client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";
const ListBudgetsSchema = z.object({
    limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
    page: z.number().int().min(1).default(1).describe("Page number"),
}).strict();
const CreateBudgetSchema = z.object({
    name: z.string().min(1).describe("Budget name"),
    active: z.boolean().optional().default(true).describe("Whether the budget is active"),
    auto_budget_type: z.enum(["none", "reset", "rollover"]).optional().describe("Auto-budget type: 'none', 'reset' (resets each period), 'rollover' (rolls over unused funds)"),
    auto_budget_amount: z.string().optional().describe("Auto-budget amount per period (e.g. '500.00')"),
    auto_budget_period: z.enum(["daily", "weekly", "monthly", "quarterly", "half-year", "yearly"]).optional().describe("Auto-budget period"),
    auto_budget_currency_code: z.string().optional().describe("Currency for auto-budget (e.g. 'USD')"),
    notes: z.string().optional().describe("Optional notes"),
}).strict();
const UpdateBudgetSchema = z.object({
    id: z.string().describe("Budget ID"),
    name: z.string().optional().describe("Updated name"),
    active: z.boolean().optional().describe("Updated active status"),
    notes: z.string().optional().describe("Updated notes"),
}).strict();
const DeleteBudgetSchema = z.object({
    id: z.string().describe("Budget ID to delete"),
}).strict();
function formatBudget(b) {
    const a = b.attributes;
    const lines = [`## ${a.name} (ID: ${b.id})`, `- Active: ${a.active ? "Yes" : "No"}`];
    if (a.auto_budget_type && a.auto_budget_type !== "none") {
        lines.push(`- Auto: ${a.auto_budget_type} — ${a.auto_budget_currency_code ?? ""}${a.auto_budget_amount ?? ""} per ${a.auto_budget_period ?? "period"}`);
    }
    if (a.notes)
        lines.push(`- Notes: ${a.notes}`);
    return lines.join("\n");
}
export function registerBudgetTools(server) {
    server.registerTool("firefly_list_budgets", {
        title: "List Firefly III Budgets",
        description: "List all budgets with their auto-budget configuration.",
        inputSchema: ListBudgetsSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const result = await apiRequest("/budgets", "GET", undefined, { limit: params.limit, page: params.page });
            if (!result.data.length)
                return { content: [{ type: "text", text: "No budgets found." }] };
            let text = `# Budgets (${result.meta.pagination.total} total)\n\n`;
            for (const b of result.data) {
                text += formatBudget(b) + "\n\n";
                if (text.length > CHARACTER_LIMIT)
                    break;
            }
            return { content: [{ type: "text", text }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
    server.registerTool("firefly_create_budget", {
        title: "Create Firefly III Budget",
        description: `Create a new budget. Budgets help you track spending limits.

Auto-budget options:
- 'reset': Budget resets to the set amount each period
- 'rollover': Unused budget rolls over to the next period
- 'none': Manual budgeting only`,
        inputSchema: CreateBudgetSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (params) => {
        try {
            const result = await apiRequest("/budgets", "POST", params);
            return { content: [{ type: "text", text: `Budget created!\n\n${formatBudget(result.data)}` }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
    server.registerTool("firefly_update_budget", {
        title: "Update Firefly III Budget",
        description: "Update an existing budget's name, status, or notes.",
        inputSchema: UpdateBudgetSchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const { id, ...updates } = params;
            const result = await apiRequest(`/budgets/${id}`, "PUT", updates);
            return { content: [{ type: "text", text: `Budget updated!\n\n${formatBudget(result.data)}` }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
    server.registerTool("firefly_delete_budget", {
        title: "Delete Firefly III Budget",
        description: "Delete a budget. Transactions linked to this budget will have their budget cleared.",
        inputSchema: DeleteBudgetSchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            await apiRequest(`/budgets/${params.id}`, "DELETE");
            return { content: [{ type: "text", text: `Budget ${params.id} deleted.` }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
}
//# sourceMappingURL=budgets.js.map