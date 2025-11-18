import type { Tool } from '../types/tool';
import { getAllToolMetadata, getAllTools as getToolsFromRegistry } from './tool-registry';

export const AVAILABLE_TOOLS: Tool[] = getToolsFromRegistry(false);

// Re-export getAllTools for external use
export function getAllTools(defaultEnabled = true): Tool[] {
  return getToolsFromRegistry(defaultEnabled);
}

export function getToolSystemPrompt(enabledTools: Tool[]): string {
  if (enabledTools.length === 0) {return '';}

  const allMetadata = getAllToolMetadata();
  const toolDescriptions = enabledTools
    .map((tool) => {
      const metadata = allMetadata.find((m) => m.id === tool.id);
      if (!metadata) {return '';}

      const promptDescription = tool.aiDescription || metadata.description;
      return `- **${metadata.id}**: ${promptDescription}
  ${metadata.formatExample}`;
    })
    .filter(Boolean)
    .join('\n');

  const hasFileTools = enabledTools.some((tool) =>
    ['write_file', 'read_file', 'list_files'].includes(tool.id),
  );

  const fileOperationPolicy = hasFileTools
    ? `

FILE OPERATION GUIDANCE:
- You have access to workspace file operations via VSCode extension
- All operations are performed on the actual workspace files
- File paths are relative to workspace root or absolute paths

TOOL USAGE:
- read_file: Read file content with optional line range
  * Example: {"path": "src/app.ts", "startLine": 10, "endLine": 50}
  * Use once per file - don't re-read after operations
- write_file: Create or overwrite files with content
  * Example: {"path": "src/new-file.ts", "content": "export const x = 1;"}
  * Creates parent directories automatically
- list_files: List directory contents
  * Example: {"path": "src"} or {"path": ""} for root
  * Returns files and subdirectories

CRITICAL RULES:
1. Read files ONCE - don't re-read after editing
2. Use write_file only for creating NEW files or complete rewrites
3. File paths use forward slashes (e.g., "src/components/Button.tsx")`
    : '';

  const toolSection = `🚨 TOOL FORMAT REQUIREMENTS 🚨

USE ONLY THIS EXACT FORMAT FOR ALL TOOLS:
\`\`\`tool:TOOL_NAME
{JSON parameters}
\`\`\`

TOOLS AVAILABLE:
${toolDescriptions}${fileOperationPolicy}

TOOL USAGE EXAMPLES:
${enabledTools
  .map((tool) => {
    const examples: Record<string, string> = {
      read_file: `Read File:
\`\`\`tool:read_file
{"path": "src/app.ts"}
\`\`\`

Read File with Line Range:
\`\`\`tool:read_file
{"path": "src/app.ts", "startLine": 10, "endLine": 50}
\`\`\``,
      write_file: `Write File:
\`\`\`tool:write_file
{"path": "src/new-file.ts", "content": "export const hello = 'world';"}
\`\`\``,
      list_files: `List Files:
\`\`\`tool:list_files
{"path": "src"}
\`\`\`

List Root Directory:
\`\`\`tool:list_files
{"path": ""}
\`\`\``,
    };
    return examples[tool.id] || '';
  })
  .filter(Boolean)
  .join('\n\n')}

TOOL EXECUTION FLOW:
1. Evaluate if you need to use a tool
2. Output the tool call block in your response
3. System will execute and provide results
4. Continue with the tool results in context

🚨 CRITICAL: Always use triple backticks format \`\`\`tool:TOOL_NAME`;

  return toolSection;
}
