/**
 * File Read Deduplicator
 * 
 * Identifies stale read_file results in chat history.
 * When a file is read multiple times, only the LAST read should be kept.
 * Earlier reads are marked as stale to prevent AI confusion with outdated content.
 */

import type { Message } from '../types/chat';
import type { ToolExecutionState } from '../types/tool';

/**
 * Represents a file read occurrence in the conversation
 */
interface FileReadOccurrence {
  executionId: string;
  filePath: string;
  messageIndex: number;
}

/**
 * Extract file path from a read_file execution result
 */
function extractFilePath(execution: ToolExecutionState): string | null {
  if (execution.toolName !== 'read_file') {
    return null;
  }
  
  if (execution.status !== 'completed' || !execution.result?.success) {
    return null;
  }
  
  const data = execution.result.data as Record<string, unknown>;
  
  // Single file case
  if ('path' in data && typeof data.path === 'string') {
    return data.path;
  }
  
  return null;
}

/**
 * Extract all file paths from a read_file execution (handles multi-file reads)
 */
function extractAllFilePaths(execution: ToolExecutionState): string[] {
  if (execution.toolName !== 'read_file') {
    return [];
  }
  
  if (execution.status !== 'completed' || !execution.result?.success) {
    return [];
  }
  
  const data = execution.result.data as Record<string, unknown>;
  const paths: string[] = [];
  
  // Single file case
  if ('path' in data && typeof data.path === 'string') {
    paths.push(data.path);
  }
  
  // Multi-file case
  if ('files' in data && Array.isArray(data.files)) {
    for (const file of data.files) {
      if (file && typeof file === 'object' && 'path' in file && typeof file.path === 'string') {
        paths.push(file.path);
      }
    }
  }
  
  return paths;
}

/**
 * Scan all messages and identify which read_file executions are stale.
 * A read is stale if the same file path is read again later in the conversation.
 * 
 * @param messages - All messages in the conversation
 * @returns Set of execution IDs that are stale (should be summarized, not shown in full)
 */
export function identifyStaleFileReads(messages: Message[]): Set<string> {
  // Collect all read_file occurrences
  const allReads: FileReadOccurrence[] = [];
  
  messages.forEach((msg, messageIndex) => {
    if (!msg.toolExecutions || msg.toolExecutions.size === 0) {
      return;
    }
    
    msg.toolExecutions.forEach((execution) => {
      const filePath = extractFilePath(execution);
      if (filePath) {
        allReads.push({
          executionId: execution.toolExecutionId,
          filePath,
          messageIndex,
        });
      }
      
      // Handle multi-file reads - each file path is tracked separately
      const allPaths = extractAllFilePaths(execution);
      for (const path of allPaths) {
        if (path !== filePath) { // Avoid duplicating single file case
          allReads.push({
            executionId: execution.toolExecutionId,
            filePath: path,
            messageIndex,
          });
        }
      }
    });
  });
  
  // Group reads by file path
  const readsByPath = new Map<string, FileReadOccurrence[]>();
  for (const read of allReads) {
    const existing = readsByPath.get(read.filePath) || [];
    existing.push(read);
    readsByPath.set(read.filePath, existing);
  }
  
  // Identify stale reads: all but the last read of each file
  const staleExecutionIds = new Set<string>();
  
  for (const [, reads] of readsByPath) {
    if (reads.length <= 1) {
      continue; // Only one read, not stale
    }
    
    // Sort by message index to ensure chronological order
    reads.sort((a, b) => a.messageIndex - b.messageIndex);
    
    // All reads except the last one are stale
    for (let i = 0; i < reads.length - 1; i++) {
      staleExecutionIds.add(reads[i].executionId);
    }
  }
  
  return staleExecutionIds;
}

/**
 * For multi-file reads, identify which specific file paths within an execution are stale.
 * This is needed because a single read_file call might read multiple files,
 * and only some of them might be stale.
 * 
 * @param messages - All messages in the conversation
 * @returns Map of execution ID -> Set of stale file paths within that execution
 */
export function identifyStaleFilePaths(messages: Message[]): Map<string, Set<string>> {
  // Track the last read for each file path: path -> executionId
  const lastReadByPath = new Map<string, string>();
  
  // First pass: find the last read for each file path
  messages.forEach((msg) => {
    if (!msg.toolExecutions || msg.toolExecutions.size === 0) {
      return;
    }
    
    msg.toolExecutions.forEach((execution) => {
      const paths = extractAllFilePaths(execution);
      for (const path of paths) {
        // Later reads overwrite earlier ones
        lastReadByPath.set(path, execution.toolExecutionId);
      }
    });
  });
  
  // Second pass: mark paths as stale if they're not the last read
  const stalePathsByExecution = new Map<string, Set<string>>();
  
  messages.forEach((msg) => {
    if (!msg.toolExecutions || msg.toolExecutions.size === 0) {
      return;
    }
    
    msg.toolExecutions.forEach((execution) => {
      const paths = extractAllFilePaths(execution);
      for (const path of paths) {
        const lastReadId = lastReadByPath.get(path);
        if (lastReadId && lastReadId !== execution.toolExecutionId) {
          // This path was read again later, mark it as stale
          let stalePaths = stalePathsByExecution.get(execution.toolExecutionId);
          if (!stalePaths) {
            stalePaths = new Set<string>();
            stalePathsByExecution.set(execution.toolExecutionId, stalePaths);
          }
          stalePaths.add(path);
        }
      }
    });
  });
  
  return stalePathsByExecution;
}