/**
 * Tag tools for Firefly III MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest, handleApiError } from "../services/api-client.js";
import { CHARACTER_LIMIT, DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

const ListTagsSchema = z.object({
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe("Max results"),
  page: z.number().int().min(1).default(1).describe("Page number"),
}).strict();

const CreateTagSchema = z.object({
  tag: z.string().min(1).describe("Tag name"),
  description: z.string().optional().describe("Tag description"),
}).strict();

const UpdateTagSchema = z.object({
  tag: z.string().describe("Current tag name (used as identifier)"),
  description: z.string().optional().describe("Updated description"),
}).strict();

const DeleteTagSchema = z.object({
  tag: z.string().describe("Tag name to delete"),
}).strict();

interface FireflyTag {
  id: string;
  attributes: { tag: string; description: string | null };
}

export function registerTagTools(server: McpServer): void {
  server.registerTool(
    "firefly_list_tags",
    {
      title: "List Firefly III Tags",
      description: "List all tags. Tags are flexible labels you can attach to transactions.",
      inputSchema: ListTagsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await apiRequest<{ data: FireflyTag[]; meta: { pagination: { total: number } } }>(
          "/tags", "GET", undefined, { limit: params.limit, page: params.page }
        );
        if (!result.data.length) return { content: [{ type: "text" as const, text: "No tags found." }] };
        let text = `# Tags (${result.meta.pagination.total} total)\n\n`;
        for (const t of result.data) {
          text += `- **${t.attributes.tag}** (ID: ${t.id})${t.attributes.description ? ` — ${t.attributes.description}` : ""}\n`;
          if (text.length > CHARACTER_LIMIT) break;
        }
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "firefly_create_tag",
    {
      title: "Create Firefly III Tag",
      description: "Create a new tag for labeling transactions.",
      inputSchema: CreateTagSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const result = await apiRequest<{ data: FireflyTag }>("/tags", "POST", params);
        return { content: [{ type: "text" as const, text: `Tag created: **${result.data.attributes.tag}** (ID: ${result.data.id})` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "firefly_update_tag",
    {
      title: "Update Firefly III Tag",
      description: "Update an existing tag's description.",
      inputSchema: UpdateTagSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        const { tag, ...updates } = params;
        const result = await apiRequest<{ data: FireflyTag }>(`/tags/${encodeURIComponent(tag)}`, "PUT", { tag, ...updates });
        return { content: [{ type: "text" as const, text: `Tag updated: **${result.data.attributes.tag}**` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "firefly_delete_tag",
    {
      title: "Delete Firefly III Tag",
      description: "Delete a tag. It will be removed from all transactions that use it.",
      inputSchema: DeleteTagSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async (params) => {
      try {
        await apiRequest(`/tags/${encodeURIComponent(params.tag)}`, "DELETE");
        return { content: [{ type: "text" as const, text: `Tag "${params.tag}" deleted.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
