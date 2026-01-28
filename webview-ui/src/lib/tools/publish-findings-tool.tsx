import { FileCheck2 } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';
import { TOOL_FUNCTION_CALLS_CLOSE, TOOL_FUNCTION_CALLS_OPEN, TOOL_XML_NAMESPACE } from '../tool-xml';

/**
 * Publish Findings Tool Result Types
 */
export interface PublishFindingsResult {
  awaitsUserAction: boolean;
  actionType: string;
  message: string;
  reviewId: string;
  path: string;
  absolutePath: string;
  title: string;
  timestamp: string;
  lineCount: number;
  reviewContent?: string;
  scope?: string;
  userAction?: string;
}

/**
 * Check if a result is a publish findings result
 */
export function isPublishFindingsResult(data: unknown): data is PublishFindingsResult {
  return (
    typeof data === 'object' &&
    data !== null &&
    'reviewId' in data &&
    'path' in data
  );
}

/**
 * Publish Findings Tool - Exclusive to Review Mode
 * 
 * Creates comprehensive code review reports in .echode/codereview/
 */
async function executePublishFindings(
  parameters: Record<string, unknown>,
  signal?: AbortSignal,
  _onStatusChange?: unknown,
  _onProgress?: unknown,
  mode?: ChatMode,
): Promise<ToolExecutionResult> {
  return executeToolViaExtension('publish_findings', parameters, signal, undefined, mode);
}

// Register publish_findings tool
registerToolPlugin({
  metadata: {
    id: 'publish_findings',
    name: 'Publish Findings',
    description: 'Publish a comprehensive code review report',
    aiDescription: `Create and save a code review report to .echode/codereview/.

Parameters:
- content: The complete code review in markdown format (required)
- title: Custom report title (optional, defaults to "Code Review Report")
- scope: Description of what was reviewed (optional)

The report is saved with a unique ID and timestamp.
Use this after completing your thorough code analysis.`,
    icon: FileCheck2,
    usage: 'Publish code review findings to a markdown report',
    formatExample: `${TOOL_FUNCTION_CALLS_OPEN}
<${TOOL_XML_NAMESPACE}:invoke name="publish_findings">
<${TOOL_XML_NAMESPACE}:parameter name="content">## Summary
Overall code quality is good with some areas for improvement.

## Critical Issues
- **Line 45**: Potential null pointer exception
- **Line 89**: SQL injection vulnerability

## Recommendations
1. Add input validation
2. Implement error handling
</${TOOL_XML_NAMESPACE}:parameter>
<${TOOL_XML_NAMESPACE}:parameter name="title">Authentication Module Review</${TOOL_XML_NAMESPACE}:parameter>
<${TOOL_XML_NAMESPACE}:parameter name="scope">src/auth/**</${TOOL_XML_NAMESPACE}:parameter>
</${TOOL_XML_NAMESPACE}:invoke>
${TOOL_FUNCTION_CALLS_CLOSE}`,
  },
  handler: {
    execute: executePublishFindings,
  },
  renderer: (data: unknown) => {
    if (!isPublishFindingsResult(data)) {
      return (
        <div className="text-sm" style={{ color: 'var(--vscode-errorForeground)' }}>
          Invalid publish findings result
        </div>
      );
    }

    return <ReviewPublishedRenderer result={data} />;
  },
});

/**
 * Truncates content by maximum number of lines
 */
function truncateByLines(content: string, maxLines: number = 5): string {
  if (!content) return '';
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return content;
  }
  return lines.slice(0, maxLines).join('\n');
}

/**
 * Review Content Snippet - Shows truncated review content by lines
 */
function ReviewContentSnippet({ content }: { content?: string }) {
  if (!content) return null;
  
  const truncated = truncateByLines(content);
  
  return (
    <div
      className="py-2 px-3 rounded-lg font-mono text-xs whitespace-pre-wrap overflow-hidden"
      style={{ 
        backgroundColor: 'var(--vscode-textBlockQuote-background)',
        color: 'var(--vscode-input-foreground)',
        maxHeight: '200px',
      }}
    >
      {truncated}
    </div>
  );
}

/**
 * Review Published Renderer - Shows review was published with content snippet
 */
function ReviewPublishedRenderer({ result }: { result: PublishFindingsResult }) {
  return (
    <div className="text-sm space-y-3">
      {/* Title */}
      {result.title && (
        <div
          className="font-medium"
          style={{ color: 'var(--vscode-input-foreground)' }}
        >
          {result.title}
        </div>
      )}

      {/* Content Preview */}
      <ReviewContentSnippet content={result.reviewContent} />
    </div>
  );
}