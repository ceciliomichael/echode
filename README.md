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
| `apply_diff` | Make surgical edits to existing files |
| `write_to_file` | Create new files or complete rewrites |
| `delete_file` | Remove files safely |
| `get_diagnostics` | Collect linter and compiler errors |
| `echo_search` | Intelligent code exploration sub-agent |

These tools mean EchoDE doesn't guess. It knows.

### Multi-Model Support

Choose the model that fits your workflow:

- **Anthropic Claude** — Claude 3.5/4 series with extended thinking
- **OpenAI** — GPT-4o, GPT-4 Turbo, o1, and newer models
- **Qwen** — Alibaba's Qwen models for cost-effective performance
- **OpenAI-Compatible** — Any provider with OpenAI-compatible API (Groq, Together, local models)
- **VS Code Language Model** — Use models provided by other VS Code extensions

Configuration happens in the sidebar. No JSON files to edit.

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

---

## Modes of Operation

### Agent Mode
The default. EchoDE reads, writes, and modifies files. Best for implementation tasks.

### Plan Mode
EchoDE explores and creates a detailed plan without making changes. Useful for understanding unfamiliar codebases or architecting before building.

### Ask Mode
Read-only exploration. EchoDE can search and read files but cannot modify anything. Ideal for code review or learning.

### Chat Mode
Pure conversation. No tools, no file access. Just discussion.

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