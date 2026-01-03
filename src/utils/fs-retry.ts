import * as vscode from 'vscode';

/**
 * Configuration for retry behavior
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 100,
  maxDelayMs: 2000,
};

/**
 * Errors that indicate a transient lock and should be retried
 */
const RETRYABLE_ERROR_PATTERNS = [
  'EBUSY',      // Resource busy (file in use)
  'EPERM',      // Operation not permitted (often transient on Windows)
  'EACCES',     // Permission denied (can be transient during antivirus scan)
  'EAGAIN',     // Resource temporarily unavailable
  'ETXTBSY',    // Text file busy (Unix)
];

/**
 * Check if an error is retryable (transient file lock)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof vscode.FileSystemError) {
    // Check the error code/message for known transient patterns
    const errorString = error.message || error.toString();
    return RETRYABLE_ERROR_PATTERNS.some(pattern => errorString.includes(pattern));
  }
  
  if (error instanceof Error) {
    const errorString = error.message || error.toString();
    return RETRYABLE_ERROR_PATTERNS.some(pattern => errorString.includes(pattern));
  }
  
  return false;
}

/**
 * Check if an error indicates the file doesn't exist
 */
function isFileNotFoundError(error: unknown): boolean {
  if (error instanceof vscode.FileSystemError) {
    // FileSystemError.FileNotFound has code 'FileNotFound'
    const errorString = error.message || error.toString();
    return errorString.includes('FileNotFound') || 
           errorString.includes('ENOENT') ||
           errorString.includes('EntryNotFound');
  }
  
  if (error instanceof Error) {
    return error.message.includes('ENOENT') || 
           error.message.includes('FileNotFound') ||
           error.message.includes('EntryNotFound');
  }
  
  return false;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Perform a file system operation with retry logic for transient errors.
 * 
 * This handles cases where external processes (dev servers, linters, antivirus)
 * temporarily lock files, especially on Windows.
 * 
 * @param operation - The async operation to perform
 * @param operationName - Name for logging purposes
 * @param config - Retry configuration (optional)
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 */
export async function performFsOperationWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs } = { ...DEFAULT_RETRY_CONFIG, ...config };
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // If it's not a retryable error, throw immediately
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // If we've exhausted retries, throw
      if (attempt === maxRetries) {
        console.error(
          `[FsRetry] ${operationName} failed after ${maxRetries + 1} attempts:`,
          error instanceof Error ? error.message : 'Unknown error'
        );
        throw new Error(
          `${operationName} failed after ${maxRetries + 1} attempts. ` +
          `The file may be locked by an external process (e.g., npm run dev, linter, antivirus). ` +
          `Try stopping the dev server or closing applications that might be using the file. ` +
          `Original error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      
      console.log(
        `[FsRetry] ${operationName} attempt ${attempt + 1}/${maxRetries + 1} failed (${
          error instanceof Error ? error.message : 'Unknown error'
        }). Retrying in ${delay}ms...`
      );
      
      await sleep(delay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Delete a file with retry logic.
 * Treats "file not found" as success (idempotent delete).
 * 
 * @param uri - The file URI to delete
 * @param options - Delete options
 */
export async function deleteFileWithRetry(
  uri: vscode.Uri,
  options: { recursive?: boolean; useTrash?: boolean } = {}
): Promise<void> {
  try {
    await performFsOperationWithRetry(
      // Wrap Thenable in Promise.resolve to ensure proper Promise type
      async () => {
        await vscode.workspace.fs.delete(uri, {
          recursive: options.recursive ?? false,
          useTrash: options.useTrash ?? false,
        });
      },
      `delete ${uri.fsPath}`
    );
  } catch (error) {
    // If file doesn't exist, treat as success (idempotent)
    if (isFileNotFoundError(error)) {
      console.log(`[FsRetry] File already deleted or doesn't exist: ${uri.fsPath}`);
      return;
    }
    throw error;
  }
}

/**
 * Write content to a file with retry logic.
 * 
 * @param uri - The file URI to write to
 * @param content - The content to write (as Uint8Array)
 */
export async function writeFileWithRetry(
  uri: vscode.Uri,
  content: Uint8Array
): Promise<void> {
  await performFsOperationWithRetry(
    // Wrap Thenable in Promise.resolve to ensure proper Promise type
    async () => {
      await vscode.workspace.fs.writeFile(uri, content);
    },
    `write ${uri.fsPath}`
  );
}