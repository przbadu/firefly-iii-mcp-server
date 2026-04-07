# Firefly III MCP Server

[![npm version](https://img.shields.io/npm/v/firefly-iii-mcp-server.svg)](https://www.npmjs.com/package/firefly-iii-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that gives Claude full access to your [Firefly III](https://www.firefly-iii.org/) personal finance instance. Talk to Claude in natural language to record expenses, check balances, manage budgets, and more.

## Features

- **Transactions**: Create, list, search, update, and delete transactions (withdrawals, deposits, transfers)
- **Accounts**: Manage asset, expense, revenue, liability, and cash accounts
- **Categories**: Organize transactions with categories
- **Budgets**: Create and manage budgets with auto-budget support
- **Tags**: Label transactions with flexible tags

## Prerequisites

- Node.js >= 18
- A running Firefly III instance
- A Personal Access Token (PAT) from your Firefly III instance

### Getting Your PAT

1. Log into your Firefly III instance
2. Go to **Options → Profile → OAuth**
3. Under **Personal Access Tokens**, create a new token
4. Copy the token — you'll need it for configuration

## Installation

### Via npm (recommended)

```bash
npm install -g firefly-iii-mcp-server
```

### From source

```bash
git clone https://github.com/przbadu/firefly-iii-mcp-server.git
cd firefly-iii-mcp-server
npm install
npm run build
```

## Configuration

### Claude Desktop

Edit your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Using the npm-installed binary:

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "firefly-iii-mcp-server",
      "env": {
        "FIREFLY_III_URL": "https://your-firefly-instance.example.com",
        "FIREFLY_III_PAT": "your-personal-access-token-here"
      }
    }
  }
}
```

Or using npx (no global install needed):

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "npx",
      "args": ["-y", "firefly-iii-mcp-server"],
      "env": {
        "FIREFLY_III_URL": "https://your-firefly-instance.example.com",
        "FIREFLY_III_PAT": "your-personal-access-token-here"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add firefly-iii \
  -e FIREFLY_III_URL=https://your-firefly-instance.example.com \
  -e FIREFLY_III_PAT=your-personal-access-token-here \
  -- npx -y firefly-iii-mcp-server
```

Or add it to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "firefly-iii": {
      "command": "npx",
      "args": ["-y", "firefly-iii-mcp-server"],
      "env": {
        "FIREFLY_III_URL": "https://your-firefly-instance.example.com",
        "FIREFLY_III_PAT": "your-personal-access-token-here"
      }
    }
  }
}
```

## Usage Examples

Once configured, just talk to Claude naturally:

### Recording Transactions

> "I spent $45.50 at Trader Joe's on groceries today"

> "Record a $2,500 salary deposit from my employer into my checking account"

> "Transfer $500 from Checking to Savings"

### Querying

> "Show me all my transactions from last week"

> "How much did I spend on restaurants this month?"

> "What's the balance of my checking account?"

### Managing Finances

> "Create a monthly grocery budget of $600"

> "List all my expense categories"

> "Tag my last 3 restaurant transactions as 'business meals'"

## Available Tools

| Tool | Description |
|------|-------------|
| `firefly_create_transaction` | Create withdrawal, deposit, or transfer |
| `firefly_list_transactions` | List transactions with filters |
| `firefly_get_transaction` | Get transaction details by ID |
| `firefly_update_transaction` | Update an existing transaction |
| `firefly_delete_transaction` | Delete a transaction |
| `firefly_search_transactions` | Search with Firefly III query syntax |
| `firefly_create_account` | Create a new account |
| `firefly_list_accounts` | List accounts by type |
| `firefly_get_account` | Get account details |
| `firefly_update_account` | Update account properties |
| `firefly_delete_account` | Delete an account |
| `firefly_list_categories` | List all categories |
| `firefly_create_category` | Create a category |
| `firefly_update_category` | Update a category |
| `firefly_delete_category` | Delete a category |
| `firefly_list_budgets` | List all budgets |
| `firefly_create_budget` | Create a budget |
| `firefly_update_budget` | Update a budget |
| `firefly_delete_budget` | Delete a budget |
| `firefly_list_tags` | List all tags |
| `firefly_create_tag` | Create a tag |
| `firefly_update_tag` | Update a tag |
| `firefly_delete_tag` | Delete a tag |

## Development

```bash
# Watch mode with auto-reload
npm run dev

# Build for production
npm run build

# Run the built server
npm start
```

## License

MIT
