import * as vscode from 'vscode';

async function delay(ms: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, ms));
}

export interface WriteFileWithRetryResult {
  success: boolean;
  attempts: number;
  finalContent?: string;
  error?: string;
}

export async function writeFileWithRetry(
  uri: vscode.Uri,
  content: string,
  maxAttempts = 3,
  retryDelayMs = 50,
): Promise<WriteFileWithRetryResult> {
  const bytes = Buffer.from(content, 'utf8');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await vscode.workspace.fs.writeFile(uri, bytes);

    const readBytes = await vscode.workspace.fs.readFile(uri);
    const readContent = Buffer.from(readBytes).toString('utf8');

    if (readContent === content) {
      return { success: true, attempts: attempt, finalContent: readContent };
    }

    if (attempt < maxAttempts) {
      await delay(retryDelayMs);
    }
  }

  return {
    success: false,
    attempts: maxAttempts,
    error: `File content did not stabilize after ${maxAttempts} write attempts. Another process may be modifying the file.`,
  };
}
