import { Radar, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { MarkdownRenderer } from '../../components/ui/markdown-renderer';
import { SearchSnippetItem } from '../../components/ui/search-snippet-item';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import type { ToolProgressCallback } from '../tool-registry';
import { getFileIconConfig } from '../../utils/file-icon-mapper';
import { storageService } from '../../utils/storage';

/**
 * Echo Search Tool - Sub-agent for iterative code search
 */
async function executeEchoSearch(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
  _onStatusChange?: unknown,
  onProgress?: ToolProgressCallback,
): Promise<ToolExecutionResult> {
  // Inject indexing settings and API credentials from storage
  const settings = storageService.getSettings();

  // Get the provider-specific model based on current main chat provider
  const getMainChatModel = () => {
    switch (settings.provider) {
      case 'anthropic': return settings.anthropicModel || settings.model;
      case 'openai': return settings.openaiModel || settings.model;
      case 'openai-compatible': return settings.openaiCompatibleModel || settings.model;
      case 'megallm': return settings.megallmModel || settings.model;
      case 'vscode-lm': return settings.vscodeLmModel || settings.model;
      case 'qwen-code': return settings.qwenCodeModel || settings.model;
      default: return settings.model;
    }
  };

  // Fall back to main chat settings if indexing model is not configured
  const rawIndexingSettings = settings.indexingSettings;
  const indexingSettings = (rawIndexingSettings && rawIndexingSettings.model)
    ? rawIndexingSettings
    : {
      enabled: rawIndexingSettings?.enabled ?? true,
      provider: settings.provider,
      model: getMainChatModel(),
    };

  // Build API settings needed by sub-agent
  const apiSettings = {
    anthropicApiKey: settings.anthropicApiKey,
    anthropicCustomUrl: settings.anthropicCustomUrl,
    openaiApiKey: settings.openaiApiKey,
    openaiCustomUrl: settings.openaiCustomUrl,
    openaiCompatibleApiKey: settings.openaiCompatibleApiKey,
    openaiCompatibleCustomUrl: settings.openaiCompatibleCustomUrl,
    megallmApiKey: settings.megallmApiKey,
    megallmCustomUrl: settings.megallmCustomUrl,
    streamingTimeout: settings.streamingTimeout,
  };

  return executeToolViaExtension(
    'echo_search',
    {
      ...parameters,
      indexingSettings,
      apiSettings,
    },
    signal,
    onProgress,
  );
}

interface SearchSnippet {
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  score: number;
  reason?: string;
}

interface EchoSearchResult {
  // Original search query (if provided by backend)
  query?: string;
  summary: string;
  highLevelAnswer?: string;
  snippets: SearchSnippet[];
  searchStats: {
    iterations: number;
    grepCalls: number;
    globCalls: number;
    readFileCalls: number;
    listDirCalls: number;
    filesScanned: number;
    totalMatches: number;
  };
}

interface SnippetItemProps {
  snippet: SearchSnippet;
  isExpanded?: boolean;
  onToggle?: () => void;
}

export function SnippetItem({ snippet, isExpanded, onToggle }: SnippetItemProps) {
  const iconConfig = getFileIconConfig(snippet.path);
  const Icon = iconConfig.icon;
  const hasCode = !!(snippet.snippet && snippet.snippet.trim().length > 0);

  // Strip line numbers from content (e.g., "48 | func..." -> "func...")
  const cleanSnippet = hasCode
    ? snippet.snippet.replace(/^\s*\d+\s+\|\s?/gm, '')
    : '';

  // Split into lines for line-numbered display (preserve trailing empty line)
  const codeLines = cleanSnippet.split('\n');

  const lines = codeLines.map((line, index) => ({
    lineNumber: snippet.startLine + index,
    text: line,
  }));

  const score = snippet.score;
  const chipLabel = `${Math.round(score * 100)}%`;
  const chipStyle = {
    backgroundColor: `rgba(var(--vscode-button-background), ${score})`,
    color: 'var(--vscode-button-foreground)',
    opacity: 0.5 + score * 0.5,
  };

  return (
    <SearchSnippetItem
      path={snippet.path}
      icon={Icon}
      iconColor={iconConfig.color}
      startLine={snippet.startLine}
      endLine={snippet.endLine}
      chipLabel={chipLabel}
      chipStyle={chipStyle}
      reason={snippet.reason}
      lines={lines}
      hasCode={hasCode}
      isExpanded={isExpanded}
      onToggle={onToggle}
    />
  );
}

function EchoSearchRendererComponent({ data }: { data: unknown }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  if (typeof data === 'object' && data !== null) {
    const result = data as EchoSearchResult;

    const isEmpty = !result.snippets || result.snippets.length === 0;

    // Calculate total tool calls for display
    const totalToolCalls = (result.searchStats?.grepCalls || 0) +
      (result.searchStats?.globCalls || 0) +
      (result.searchStats?.readFileCalls || 0) +
      (result.searchStats?.listDirCalls || 0);

    return (
      <div className="rounded-xl overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">

        {/* Summary - Collapsible */}
        <div
          className="border-b border-[var(--vscode-input-border)] bg-[var(--vscode-sideBar-background)]"
        >
          <button
            onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
            className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-[var(--vscode-list-hoverBackground)] transition-colors"
            style={{ color: 'var(--vscode-foreground)' }}
          >
            <span className="text-xs font-medium truncate flex-1 pr-2">
              {result.summary}
            </span>
            <div className="flex items-center gap-1 flex-shrink-0">
              {result.highLevelAnswer && (
                <span className="text-xs opacity-70">Details</span>
              )}
              {isSummaryExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </div>
          </button>

          {isSummaryExpanded && result.highLevelAnswer && (
            <div
              className="px-3 pb-2 pt-0 border-t border-[var(--vscode-input-border)] max-h-48 overflow-y-auto"
            >
              <div
                className="text-xs [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:text-xs [&_code]:text-xs"
                style={{ color: 'var(--vscode-foreground)' }}
              >
                <MarkdownRenderer content={result.highLevelAnswer} />
              </div>
            </div>
          )}
        </div>

        {/* Stats - Enhanced with more detail */}
        <div
          className="px-3 py-1.5 border-b border-[var(--vscode-input-border)] flex items-center flex-wrap gap-x-3 gap-y-1 text-xs"
          style={{ color: 'var(--vscode-descriptionForeground)' }}
        >
          <span title="Number of search iterations">
            {result.searchStats?.iterations || 0} turns
          </span>
          <span title="Total tool calls executed">
            {totalToolCalls} calls
          </span>
          <span title="Files scanned during search">
            {result.searchStats?.filesScanned || 0} files
          </span>
          <span title="Total pattern matches found">
            {result.searchStats?.totalMatches || 0} matches
          </span>
          {(result.searchStats?.grepCalls || 0) > 0 && (
            <span className="opacity-70" title="grep_search calls">
              grep:{result.searchStats?.grepCalls}
            </span>
          )}
          {(result.searchStats?.globCalls || 0) > 0 && (
            <span className="opacity-70" title="glob_search calls">
              glob:{result.searchStats?.globCalls}
            </span>
          )}
        </div>

        {/* Content */}
        <div>
          {isEmpty ? (
            <div className="px-3 py-4 text-xs text-center opacity-50 italic">
              No relevant code found
            </div>
          ) : (
            <div>
              {result.snippets.map((snippet, index) => (
                <SnippetItem
                  key={index}
                  snippet={snippet}
                  isExpanded={openIndex === index}
                  onToggle={() =>
                    setOpenIndex(openIndex === index ? null : index)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return <div className="text-xs opacity-70">Search completed successfully</div>;
}

function EchoSearchRenderer(data: unknown) {
  return <EchoSearchRendererComponent data={data} />;
}

// Register echo_search tool
registerToolPlugin({
  metadata: {
    id: 'echo_search',
    name: 'Echo Search',
    description: 'Sub-agent that iteratively searches the codebase to find relevant context',
    aiDescription: `## echo_search
**YOUR PRIMARY EXPLORATION TOOL.** Intelligent sub-agent that understands and navigates code.

**USE ECHO_SEARCH FIRST when:**
- You need to understand how something works
- Looking for implementations, patterns, or architecture
- Don't know exact file paths or function names
- User asks about code behavior or structure
- Exploring unfamiliar codebase areas

**DON'T USE when:**
- You already know the EXACT function/variable name → use grep_search
- You know the exact file path → use read_file

**Parameters:**
- query: Natural language description (required) - be specific!
- path: Starting directory (optional but recommended for speed)
- hints: Keywords to help locate code (optional array)

**BEST PRACTICES:**

1. **Explore BEFORE action:**
   \`\`\`
   User: "Fix the login bug"
   You: echo_search "how is login implemented" → understand → fix
   \`\`\`

2. **Be specific in queries:**
   - 🚫 "find auth" (too vague)
   - ✓ "find where user authentication token is validated"

3. **Use hints for faster searches:**
   \`\`\`xml
   <parameter name="hints">["auth", "token", "validate", "jwt"]</parameter>
   \`\`\`

4. **Narrow path when possible:**
   \`\`\`xml
   <parameter name="path">src/services</parameter>
   \`\`\`

**RETURNS:**
- summary: Quick overview of findings
- highLevelAnswer: Explanation of how code works
- snippets: Ranked relevant code locations with reasons
- searchStats: Iterations, files scanned, matches

**WORKFLOW:**
echo_search (understand) → grep_search (pinpoint) → read_file (full context) → edit`,
    icon: Radar,
    usage: 'Iteratively search the codebase to find relevant context',
    formatExample: '<function_calls>\n<invoke name="echo_search">\n<parameter name="query">How is authentication handled</parameter>\n<parameter name="path">src</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeEchoSearch,
  },
  renderer: EchoSearchRenderer,
});
