import { useState } from "react";
import { ChevronDown, ChevronRight, BookOpen, Terminal, Globe } from "lucide-react";
import { CodeBlock } from "../ui/code-block";

const STDIO_EXAMPLE = `{
  "mcpServers": {
    "my-local-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}`;

const SSE_EXAMPLE = `{
  "mcpServers": {
    "my-remote-server": {
      "url": "http://localhost:3000/sse",
      "headers": {
        "Authorization": "Bearer your-token"
      }
    }
  }
}`;

export function MCPConfigGuide() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className="mb-4 rounded-xl border overflow-hidden"
      style={{
        borderColor: "var(--vscode-widget-border)",
        backgroundColor: "var(--vscode-editor-background)",
      }}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:opacity-90 transition-opacity"
        style={{ color: "var(--vscode-foreground)" }}
        aria-expanded={isExpanded}
      >
        <BookOpen
          className="h-4 w-4 flex-shrink-0"
          style={{ color: "var(--vscode-textLink-foreground)" }}
        />
        <span className="text-sm font-medium flex-1">Configuration Guide</span>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" style={{ color: "var(--vscode-descriptionForeground)" }} />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" style={{ color: "var(--vscode-descriptionForeground)" }} />
        )}
      </button>

      {isExpanded && (
        <div
          className="px-4 pb-4 space-y-4"
          style={{ borderTop: "1px solid var(--vscode-widget-border)" }}
        >
          <p
            className="text-sm pt-3"
            style={{ color: "var(--vscode-descriptionForeground)" }}
          >
            MCP servers can be configured using two transport modes. Click "Edit Configuration" to modify the JSON file.
          </p>

          {/* Stdio Mode Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Terminal
                className="h-4 w-4"
                style={{ color: "var(--vscode-terminal-ansiGreen)" }}
              />
              <h4
                className="text-sm font-medium"
                style={{ color: "var(--vscode-foreground)" }}
              >
                Stdio Mode (Local Command)
              </h4>
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--vscode-descriptionForeground)" }}
            >
              Runs a local command as a subprocess. Use this when the MCP server is installed locally on your machine.
            </p>
            <ul
              className="text-xs list-disc list-inside space-y-1"
              style={{ color: "var(--vscode-descriptionForeground)" }}
            >
              <li><code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>command</code> — The executable to run (e.g., <code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>node</code>, <code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>python</code>, <code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>npx</code>)</li>
              <li><code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>args</code> — Command-line arguments as an array</li>
              <li><code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>env</code> — Environment variables (optional)</li>
            </ul>
            <CodeBlock className="language-json">{STDIO_EXAMPLE}</CodeBlock>
          </div>

          {/* SSE Mode Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe
                className="h-4 w-4"
                style={{ color: "var(--vscode-terminal-ansiBlue)" }}
              />
              <h4
                className="text-sm font-medium"
                style={{ color: "var(--vscode-foreground)" }}
              >
                SSE Mode (Remote Server)
              </h4>
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--vscode-descriptionForeground)" }}
            >
              Connects to a remote MCP server via Server-Sent Events (SSE). Use this for cloud-hosted or remote MCP servers.
            </p>
            <ul
              className="text-xs list-disc list-inside space-y-1"
              style={{ color: "var(--vscode-descriptionForeground)" }}
            >
              <li><code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>url</code> — The SSE endpoint URL</li>
              <li><code className="px-1 py-0.5 rounded" style={{ backgroundColor: "var(--vscode-textCodeBlock-background)" }}>headers</code> — Custom HTTP headers for authentication (optional)</li>
            </ul>
            <CodeBlock className="language-json">{SSE_EXAMPLE}</CodeBlock>
          </div>
        </div>
      )}
    </div>
  );
}