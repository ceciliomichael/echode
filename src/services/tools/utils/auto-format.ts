import * as vscode from 'vscode';

const FORMATTABLE_CODE_EXTENSIONS = new Set([
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'json',
  'jsonc',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'xml',
  'md',
  'mdx',
]);

export interface AutoFormatResult {
  content: string;
  applied: boolean;
  reason?: string;
}

function getExtension(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return ext ?? '';
}

function isLikelyMinifiedCode(content: string): boolean {
  const lineCount = content.split(/\r?\n/).length;
  if (lineCount > 3 || content.length < 160) {
    return false;
  }

  const hasCodeSignals =
    /[{};]/.test(content)
    || /<\/?[A-Za-z][^>]*>/.test(content)
    || /\b(import|export|function|const|let|class|return)\b/.test(content);

  if (!hasCodeSignals) {
    return false;
  }

  // Heuristic: many tokens separated by single spaces with very few line breaks.
  const spaceCount = (content.match(/ /g) ?? []).length;
  return spaceCount >= 20;
}

function shouldAttemptAutoFormat(filePath: string, content: string): boolean {
  const ext = getExtension(filePath);
  if (!FORMATTABLE_CODE_EXTENSIONS.has(ext)) {
    return false;
  }

  return isLikelyMinifiedCode(content);
}

export async function autoFormatIfLikelyMinified(
  uri: vscode.Uri,
  filePath: string,
  currentContent: string
): Promise<AutoFormatResult> {
  if (!shouldAttemptAutoFormat(filePath, currentContent)) {
    return { content: currentContent, applied: false };
  }

  try {
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
      'vscode.executeFormatDocumentProvider',
      uri
    );

    if (!edits || edits.length === 0) {
      return { content: currentContent, applied: false, reason: 'no_formatter_edits' };
    }

    const workspaceEdit = new vscode.WorkspaceEdit();
    workspaceEdit.set(uri, edits);
    const applied = await vscode.workspace.applyEdit(workspaceEdit);
    if (!applied) {
      return { content: currentContent, applied: false, reason: 'apply_edit_failed' };
    }

    const document = await vscode.workspace.openTextDocument(uri);
    await document.save();
    const formattedContent = document.getText();

    return {
      content: formattedContent,
      applied: formattedContent !== currentContent,
      reason: formattedContent !== currentContent ? 'formatted' : 'unchanged',
    };
  } catch (error) {
    return {
      content: currentContent,
      applied: false,
      reason: `format_error:${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

