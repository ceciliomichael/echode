import { Search } from 'lucide-react';
import { useState } from 'react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension } from '../tool-utils';
import { getFileIconConfig } from '../../utils/file-icon-mapper';
import { SearchSnippetItem } from '../../components/ui/search-snippet-item';

interface GrepFileResult {
  file: string;
  matches: Array<{
    line: number;
    column: number;
    text: string;
    matchText: string;
  }>;
}
interface GrepFileItemProps {
  fileResult: GrepFileResult;
  query?: string;
  isRegex?: boolean;
  caseSensitive?: boolean;
  maxMatchesPerFile?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

function GrepFileItem({
  fileResult,
  query,
  isRegex,
  caseSensitive,
  maxMatchesPerFile,
  isExpanded,
  onToggle,
}: GrepFileItemProps) {
  const iconConfig = getFileIconConfig(fileResult.file);
  const Icon = iconConfig.icon;
  const hasMatches = fileResult.matches && fileResult.matches.length > 0;

  if (!hasMatches) {
    return null;
  }

  const startLine = Math.min(...fileResult.matches.map((match) => match.line));
  const endLine = Math.max(...fileResult.matches.map((match) => match.line));

  const lines = fileResult.matches.map((match) => ({
    lineNumber: match.line,
    text: match.text ?? '',
  }));

  const safeMax =
    maxMatchesPerFile && maxMatchesPerFile > 0
      ? maxMatchesPerFile
      : fileResult.matches.length;

  const rawScore = safeMax > 0 ? fileResult.matches.length / safeMax : 1;
  const score = Math.max(0.05, Math.min(1, rawScore));

  const chipLabel = `${Math.round(score * 100)}%`;
  const chipStyle = {
    backgroundColor: `rgba(var(--vscode-button-background), ${score})`,
    color: 'var(--vscode-button-foreground)',
    opacity: 0.5 + score * 0.5,
  };

  const matchCountText =
    fileResult.matches.length === 1 ? 'match' : 'matches';

  const reasonParts: string[] = [];
  if (query && query.length > 0) {
    reasonParts.push(
      `${fileResult.matches.length} ${matchCountText} for "${query}" in this file`,
    );
  } else {
    reasonParts.push(
      `${fileResult.matches.length} ${matchCountText} in this file`,
    );
  }

  const modeParts: string[] = [];
  if (isRegex !== undefined) {
    modeParts.push(isRegex ? 'regex' : 'plain text');
  }
  if (caseSensitive !== undefined) {
    modeParts.push(caseSensitive ? 'case-sensitive' : 'case-insensitive');
  }
  if (modeParts.length > 0) {
    reasonParts.push(`(${modeParts.join(', ')})`);
  }

  const reason = reasonParts.join(' ');

  return (
    <SearchSnippetItem
      path={fileResult.file}
      icon={Icon}
      iconColor={iconConfig.color}
      startLine={startLine}
      endLine={endLine}
      chipLabel={chipLabel}
      chipStyle={chipStyle}
      reason={reason}
      lines={lines}
      hasCode={hasMatches}
      isExpanded={isExpanded}
      onToggle={onToggle}
    />
  );
}

/**
 * Grep Search Tool
 */
async function executeGrepSearch(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('grep_search', parameters, signal);
}

function GrepSearchRendererComponent({ data }: { data: unknown }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (typeof data === 'object' && data !== null) {
    const result = data as {
      query: string;
      isRegex: boolean;
      caseSensitive: boolean;
      totalMatches: number;
      filesWithMatches: number;
      results: GrepFileResult[];
    };

    // Safety check: ensure results is an array
    const results = Array.isArray(result.results) ? result.results : [];
    const isEmpty = results.length === 0;

    const maxMatchesPerFile = results.reduce(
      (max, fileResult) =>
        fileResult.matches?.length > max ? fileResult.matches.length : max,
      0,
    );

    return (
      <div className="rounded-md overflow-hidden border border-[var(--vscode-input-border)] bg-[var(--vscode-editor-background)]">
        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {isEmpty ? (
            <div className="px-3 py-4 text-xs text-center opacity-50 italic">
              No matches found
            </div>
          ) : (
            <div>
              {results.map((fileResult, index) => (
                <GrepFileItem
                  key={index}
                  fileResult={fileResult}
                  query={result.query}
                  isRegex={result.isRegex}
                  caseSensitive={result.caseSensitive}
                  maxMatchesPerFile={maxMatchesPerFile}
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

function GrepSearchRenderer(data: unknown) {
  return <GrepSearchRendererComponent data={data} />;
}

// Register grep_search tool
registerToolPlugin({
  metadata: {
    id: 'grep_search',
    name: 'Grep Search',
    description: 'Search for patterns across workspace files',
    aiDescription: `## grep_search
Description: Simple text search across workspace files. Use this ONLY when you already know the EXACT identifier (function name, variable, class name) you're looking for.

**When to use grep_search vs echo_search:**
- Use grep_search: You know the exact name (e.g., "handleSubmit", "UserService", "AUTH_TOKEN")
- Use echo_search: You need to explore, understand, or find implementations (use echo_search FIRST for exploration)

Parameters:
- query: (required) The EXACT text to search for (function name, variable, etc.)
- path: (optional) Directory to search in. ALWAYS narrow this.
- isRegex: (optional) true for regex, false for plain text (default: false)
- includes: (optional) File globs to filter (e.g., *.ts,*.tsx)

Examples:

1. Find function references:
<function_calls>
<invoke name="grep_search">
<parameter name="query">handleSubmit</parameter>
<parameter name="path">src</parameter>
</invoke>
</function_calls>

2. Search multiple patterns in parallel:
<function_calls>
<invoke name="grep_search">
<parameter name="query">handleSubmit</parameter>
<parameter name="path">src</parameter>
</invoke>
<invoke name="grep_search">
<parameter name="query">handleChange</parameter>
<parameter name="path">src</parameter>
</invoke>
<invoke name="grep_search">
<parameter name="query">handleClick</parameter>
<parameter name="path">src</parameter>
</invoke>
</function_calls>

3. Find interface in TypeScript files:
<function_calls>
<invoke name="grep_search">
<parameter name="query">interface User</parameter>
<parameter name="path">src</parameter>
<parameter name="includes">*.ts,*.tsx</parameter>
</invoke>
</function_calls>

IMPORTANT:
- Only use when you know the EXACT identifier
- For exploration or understanding code, use echo_search instead
- Always narrow path to relevant directory
- After finding matches, use read_file for full context
- Use multiple <invoke> blocks within a single <function_calls> to search multiple patterns in parallel`,
    icon: Search,
    usage: 'Search for patterns across workspace files',
    formatExample: '<function_calls>\n<invoke name="grep_search">\n<parameter name="query">function</parameter>\n<parameter name="path">src</parameter>\n</invoke>\n</function_calls>',
  },
  handler: {
    execute: executeGrepSearch,
  },
  renderer: GrepSearchRenderer,
});

export { GrepFileItem };
