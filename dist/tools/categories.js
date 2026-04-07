/**
 * Category tools for Firefly III MCP server.
 */
import { z } from "zod";
import { apiRequest, handleApiError } from "../services/api-client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";
const ListCategoriesSchema = z.object({
    limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
    page: z.number().int().min(1).default(1).describe("Page number"),
}).strict();
const CreateCategorySchema = z.object({
    name: z.string().min(1).describe("Category name"),
    notes: z.string().optional().describe("Optional notes"),
}).strict();
const UpdateCategorySchema = z.object({
    id: z.string().describe("Category ID"),
    name: z.string().optional().describe("Updated name"),
    notes: z.string().optional().describe("Updated notes"),
}).strict();
const DeleteCategorySchema = z.object({
    id: z.string().describe("Category ID to delete"),
}).strict();
function formatCategory(c) {
    return `- **${c.attributes.name}** (ID: ${c.id})${c.attributes.notes ? ` — ${c.attributes.notes}` : ""}`;
}
export function registerCategoryTools(server) {
    server.registerTool("firefly_list_categories", {
        title: "List Firefly III Categories",
        description: "List all categories. Use categories to classify transactions (e.g. Groceries, Rent, Entertainment).",
        inputSchema: ListCategoriesSchema,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const result = await apiRequest("/categories", "GET", undefined, { limit: params.limit, page: params.page });
            if (!result.data.length)
                return { content: [{ type: "text", text: "No categories found." }] };
            let text = `# Categories (${result.meta.pagination.total} total)\n\n`;
            for (const c of result.data) {
                text += formatCategory(c) + "\n";
                if (text.length > CHARACTER_LIMIT)
                    break;
            }
            return { content: [{ type: "text", text }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
    server.registerTool("firefly_create_category", {
        title: "Create Firefly III Category",
        description: "Create a new transaction category.",
        inputSchema: CreateCategorySchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    }, async (params) => {
        try {
            const result = await apiRequest("/categories", "POST", params);
            return { content: [{ type: "text", text: `Category created: ${formatCategory(result.data)}` }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
    server.registerTool("firefly_update_category", {
        title: "Update Firefly III Category",
        description: "Update an existing category's name or notes.",
        inputSchema: UpdateCategorySchema,
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            const { id, ...updates } = params;
            const result = await apiRequest(`/categories/${id}`, "PUT", updates);
            return { content: [{ type: "text", text: `Category updated: ${formatCategory(result.data)}` }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
    server.registerTool("firefly_delete_category", {
        title: "Delete Firefly III Category",
        description: "Delete a category. Transactions using this category will have their category cleared.",
        inputSchema: DeleteCategorySchema,
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    }, async (params) => {
        try {
            await apiRequest(`/categories/${params.id}`, "DELETE");
            return { content: [{ type: "text", text: `Category ${params.id} deleted.` }] };
        }
        catch (error) {
            return { content: [{ type: "text", text: handleApiError(error) }], isError: true };
        }
    });
}
//# sourceMappingURL=categories.js.map