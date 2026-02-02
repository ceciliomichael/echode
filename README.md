# EchoDE

**An autonomous coding agent that reads, understands, and writes code alongside you.**

Most AI coding tools wait for you to explain what you need. EchoDE is different. It explores your codebase, understands the architecture, and takes action—all within VS Code.

---

## The Problem with Traditional Copilots

You paste code into a chat. You explain the context. You describe the file structure. You fix the hallucinated imports. Repeat.

EchoDE eliminates this friction. It has direct access to your workspace and a suite of tools to navigate it. When you ask it to fix a bug, it finds the relevant files first. When you ask it to add a feature, it understands where that feature should live.

---

## How It Works

EchoDE operates as an **agent**, not just a text generator. It follows a structured workflow:

1. **Understand** — Searches and reads your codebase to gather context
2. **Plan** — Creates a task list and outlines the approach
3. **Execute** — Makes targeted edits with precision
4. **Verify** — Runs diagnostics and fixes errors automatically

This loop happens transparently. You see what it reads, what it plans, and what it changes—before it happens.

---

## Core Capabilities

### Agentic Tooling

EchoDE can invoke tools to interact with your workspace:

| Tool | Purpose |
|------|---------|
| `read_file` | Read file contents with line numbers |
| `grep_search` | Fast text search across the codebase |
| `glob_search` | Find files by pattern |
| `list_files` | Explore directory structure |
| `edit` | Make surgical edits to existing files |
| `write_to_file` | Create new files or complete rewrites |
| `delete_file` | Remove files safely |
| `get_diagnostics` | Collect linter and compiler errors |
| `todo_write` | Create and manage task lists |
| `todo_read` | Review current task progress |
| `plan` | Create detailed implementation plans in Plan Mode |

These tools mean EchoDE doesn't guess. It knows.

### Multi-Model Support

Choose the model that fits your workflow:

- **Anthropic Claude** — Claude 3.5/4 series with extended thinking
- **OpenAI** — GPT-4o, GPT-4 Turbo, o1, and newer models
- **Qwen** — Alibaba's Qwen models for cost-effective performance
- **OpenAI-Compatible** — Any provider with OpenAI-compatible API (Groq, Together, local models)
- **VS Code Language Model** — Use models provided by other VS Code extensions
- **Custom Providers** — Define your own OpenAI-compatible endpoints

Configuration happens in the sidebar. No JSON files to edit.

### Custom Providers

Add your own OpenAI-compatible providers for maximum flexibility:

1. Open Settings > API Configuration
2. Click "Add Custom Provider"
3. Enter a name, base URL, and optional API key
4. Select your custom provider from the dropdown

Useful for self-hosted models, private endpoints, or providers not natively supported.

### MCP (Model Context Protocol)

EchoDE supports MCP servers, allowing you to extend the agent with external tools. MCP enables integration with databases, APIs, file systems, and custom services.

Configuration:

1. Open Settings > MCP Servers
2. Click "Edit Configuration" to open the JSON config file
3. Define your MCP servers (stdio or HTTP transport)
4. Connect servers individually and toggle tools on/off

Example configuration:
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/mydb"]
    }
  }
}
```

MCP tools appear alongside built-in tools and can be enabled or disabled per server.

### Intelligent Autocomplete

Beyond chat, EchoDE provides inline code suggestions as you type.

| Keybinding | Action |
|------------|--------|
| `Ctrl+Shift+Space` | Trigger autocomplete manually |
| `Ctrl+Right` | Accept next word |
| `Ctrl+Down` | Accept next line |

Partial acceptance lets you take what you need without committing to the full suggestion.

### Auto-Diagnostics

After every file edit, EchoDE automatically checks for errors.

If it breaks something, it knows immediately—and attempts to fix it. This self-healing behavior reduces the back-and-forth of "you introduced a type error" messages.

Configuration options:

| Setting | Default | Description |
|---------|---------|-------------|
| `echode.diagnostics.enabled` | `true` | Enable automatic error detection |
| `echode.diagnostics.delay` | `800ms` | Wait time for language server analysis |
| `echode.diagnostics.maxIterations` | `3` | Maximum automatic fix attempts |
| `echode.diagnostics.timeout` | `5000ms` | Maximum wait time for diagnostics |

### Git Integration

One-click commit message generation. EchoDE analyzes your staged changes and writes a conventional commit message. No more staring at a blank input field.

Access it from the Source Control panel or via command palette.

### Chat History

All conversations are saved automatically. Access previous sessions through the History panel:

- Search sessions by title
- Load any previous conversation
- Delete sessions you no longer need

Sessions persist across VS Code restarts.

### System Prompt Customization

Define custom instructions that shape the AI's behavior:

**Via Settings:**
Open Settings > System Prompt and enter your custom instructions. These apply to all conversations.

**Via AGENTS.md:**
Create an `AGENTS.md` file in your workspace root. EchoDE automatically reads this file and incorporates its contents into the system prompt. Useful for project-specific coding standards, architectural guidelines, or team conventions.

The file is excluded from workspace context display but remains accessible to the agent.

### Context Management

Control how much context is sent to the model:

- **Max Context Tokens** — Set a custom limit for the context window (default: 128,000)

Configure in Settings > Context.

---

## Modes of Operation

EchoDE operates in four distinct modes, each designed for specific workflows. Switch modes using the dropdown in the chat header.

### Agent Mode

The default and most powerful mode. EchoDE has full read-write access to your workspace.

**Available Tools:**
- File operations: `read_file`, `write_to_file`, `edit`, `delete_file`
- Search: `grep_search`, `glob_search`, `list_files`
- Task management: `todo_write`, `todo_read`
- Quality assurance: `get_diagnostics`

**Workflow:**
1. Receives your request
2. Searches the codebase to gather context
3. Creates a task list to track progress
4. Makes targeted edits using `edit` or `write_to_file`
5. Runs diagnostics to catch and fix errors
6. Continues until the task is complete

**Best for:** Feature implementation, bug fixes, refactoring, code generation.

### Plan Mode

Exploration and architecture mode. EchoDE analyzes your codebase and produces a detailed implementation plan without modifying any files.

**Available Tools:**
- Search: `grep_search`, `glob_search`, `list_files`
- Read-only: `read_file`
- Planning: `plan`, `todo_write`, `todo_read`

**Workflow:**
1. Explores the codebase to understand structure
2. Identifies relevant files and dependencies
3. Produces a step-by-step implementation plan
4. Outputs the plan using the `plan` tool for structured display

**Best for:** Understanding unfamiliar codebases, architectural decisions, scoping work before implementation, onboarding to new projects.

### Ask Mode

Read-only exploration mode. EchoDE can search and read your codebase but cannot modify anything.

**Available Tools:**
- Search: `grep_search`, `glob_search`, `list_files`
- Read-only: `read_file`

**Workflow:**
1. Receives your question
2. Searches for relevant code
3. Reads files to understand context
4. Provides explanations and answers

**Best for:** Code review, learning how something works, understanding dependencies, answering architectural questions.

### Chat Mode

Pure conversation mode. No tools, no file access. EchoDE responds based solely on its training and any context you provide in the message.

**Available Tools:** None

**Workflow:** Direct question-and-answer without workspace interaction.

**Best for:** General programming questions, discussing concepts, brainstorming ideas, conversations unrelated to your current codebase.

### Review Mode

Code analysis mode. EchoDE reviews your codebase and publishes structured findings without making changes.

**Available Tools:**
- Search: `grep_search`, `glob_search`, `list_files`
- Read-only: `read_file`
- Analysis: `get_diagnostics`, `publish_findings`

**Workflow:**
1. Analyzes specified files or directories
2. Identifies issues, improvements, and patterns
3. Publishes findings in a structured format

**Best for:** Code audits, security reviews, identifying technical debt, quality assessments.

---

## Image Support

Attach images to your messages for visual context:

- **Screenshots:** Show UI bugs, error messages, or expected behavior
- **Mockups:** Describe designs you want to implement
- **Diagrams:** Explain architecture or data flow
- **Code screenshots:** Reference code from external sources

Supported by models with vision capabilities (Claude 3.5/4, GPT-4o, GPT-4 Turbo).

---

## Getting Started

1. **Install** — Search "EchoDE" in the VS Code Extensions marketplace
2. **Open the Sidebar** — Click the EchoDE icon in the Activity Bar
3. **Configure a Provider** — Open settings and add your API key
4. **Start Coding** — Type your request and let EchoDE work

No workspace configuration required. No `.echode` folders. It works out of the box.

---

## Feedback

Found a bug? Have a suggestion? [Open an issue on GitHub](https://github.com/ceciliomichael/echode/issues).

---

Licensed under MIT.