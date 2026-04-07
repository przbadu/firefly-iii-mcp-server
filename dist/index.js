#!/usr/bin/env node
/**
 * Firefly III MCP Server
 *
 * Provides Claude with full CRUD access to a Firefly III personal finance
 * instance via the Model Context Protocol.
 *
 * Required environment variables:
 *   FIREFLY_III_URL - Base URL of your Firefly III instance
 *   FIREFLY_III_PAT - Personal Access Token
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTransactionTools } from "./tools/transactions.js";
import { registerAccountTools } from "./tools/accounts.js";
import { registerCategoryTools } from "./tools/categories.js";
import { registerBudgetTools } from "./tools/budgets.js";
import { registerTagTools } from "./tools/tags.js";
// ── Server Setup ─────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "firefly-iii-mcp-server",
    version: "1.0.0",
});
// Register all tool groups
registerTransactionTools(server);
registerAccountTools(server);
registerCategoryTools(server);
registerBudgetTools(server);
registerTagTools(server);
// ── Start ────────────────────────────────────────────────────────────────────
async function main() {
    // Validate required env vars early
    if (!process.env.FIREFLY_III_URL) {
        console.error("ERROR: FIREFLY_III_URL environment variable is required.");
        console.error("Set it to your Firefly III instance URL (e.g. https://expense.przbadu.dev)");
        process.exit(1);
    }
    if (!process.env.FIREFLY_III_PAT) {
        console.error("ERROR: FIREFLY_III_PAT environment variable is required.");
        console.error("Generate one in Firefly III → Options → Profile → OAuth → Personal Access Tokens");
        process.exit(1);
    }
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Firefly III MCP server running via stdio");
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map