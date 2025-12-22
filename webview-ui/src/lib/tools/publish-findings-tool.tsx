import { FileCheck2 } from 'lucide-react';
import type { ToolExecutionResult } from '../../types/tool';
import { registerToolPlugin } from './tool-plugin';
import { executeToolViaExtension, type ChatMode } from '../tool-utils';

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
    formatExample: `<function_calls>
<invoke name="publish_findings">
<parameter name="content">## Summary
Overall code quality is good with some areas for improvement.

## Critical Issues
- **Line 45**: Potential null pointer exception
- **Line 89**: SQL injection vulnerability

## Recommendations
1. Add input validation
2. Implement error handling
</parameter>
<parameter name="title">Authentication Module Review</parameter>
<parameter name="scope">src/auth/**</parameter>
</invoke>
</function_calls>`,
  },
  handler: {
    execute: executePublishFindings,
  },
  renderer: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'path' in data) {
      const result = data as { path: string; reviewId?: string; title?: string };
      return (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-green-400">
            ✓ Code Review Published
          </div>
          <div className="text-xs opacity-70">
            {result.title && <span className="font-medium">{result.title}</span>}
            {result.reviewId && <span className="ml-2 text-[10px] opacity-50">ID: {result.reviewId}</span>}
          </div>
          <div className="text-xs opacity-60">{result.path}</div>
        </div>
      );
    }
    return <div className="text-xs text-green-400">✓ Review published successfully</div>;
  },
});