import * as vscode from 'vscode';
import { distance } from 'fastest-levenshtein';
import { ITool, ToolExecutionResult } from './tool.interface';
import { getWorkspaceRoot, resolveAbsolutePath } from './utils/workspace-utils';
import { DiagnosticsService, type CapturedDiagnostic } from '../diagnostics-service';

const BUFFER_LINES = 40; // Context lines to search around start_line hint
const DEFAULT_FUZZY_THRESHOLD = 0.85; // 85% similarity required for fuzzy match

interface ParsedBlock {
  index: number;
  startLineHint?: number;
  searchText: string;
  replaceText: string;
}

interface BlockResult {
  index: number;
  applied: boolean;
  similarity?: number;
  matchedLine?: number;
  error?: string;
}

/**
 * Normalize text for comparison (handles smart quotes, etc.)
 */
function normalizeString(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/\u2013/g, '-') // En dash
    .replace(/\u2014/g, '--'); // Em dash
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function getSimilarity(original: string, search: string): number {
  if (search === '') {
    return 0;
  }

  const normalizedOriginal = normalizeString(original);
  const normalizedSearch = normalizeString(search);

  if (normalizedOriginal === normalizedSearch) {
    return 1;
  }

  const dist = distance(normalizedOriginal, normalizedSearch);
  const maxLength = Math.max(normalizedOriginal.length, normalizedSearch.length);
  return 1 - dist / maxLength;
}

/**
 * Fuzzy search for best match in a range of lines
 */
function fuzzySearch(
  lines: string[],
  searchChunk: string,
  startIndex: number,
  endIndex: number
): { bestScore: number; bestMatchIndex: number; bestMatchContent: string } {
  let bestScore = 0;
  let bestMatchIndex = -1;
  let bestMatchContent = '';
  const searchLines = searchChunk.split(/\r?\n/);
  const searchLen = searchLines.length;

  // Middle-out search strategy (search from middle outward)
  const midPoint = Math.floor((startIndex + endIndex) / 2);
  let leftIndex = midPoint;
  let rightIndex = midPoint + 1;

  while (leftIndex >= startIndex || rightIndex <= endIndex - searchLen) {
    // Search left
    if (leftIndex >= startIndex) {
      const candidateLines = lines.slice(leftIndex, leftIndex + searchLen);
      const candidateChunk = candidateLines.join('\n');
      const similarity = getSimilarity(candidateChunk, searchChunk);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatchIndex = leftIndex;
        bestMatchContent = candidateChunk;
      }
      leftIndex--;
    }

    // Search right
    if (rightIndex <= endIndex - searchLen) {
      const candidateLines = lines.slice(rightIndex, rightIndex + searchLen);
      const candidateChunk = candidateLines.join('\n');
      const similarity = getSimilarity(candidateChunk, searchChunk);
      
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatchIndex = rightIndex;
        bestMatchContent = candidateChunk;
      }
      rightIndex++;
    }
  }

  return { bestScore, bestMatchIndex, bestMatchContent };
}

/**
 * Parse SEARCH/REPLACE blocks from diff string
 */
function parseDiffBlocks(diffContent: string): { blocks: ParsedBlock[]; error?: string } {
  const blocks: ParsedBlock[] = [];
  const blockRegex = /<<<<<<< SEARCH\s*\n(?::start_line:(\d+)\s*\n)?-------\s*\n([\s\S]*?)\n=======\s*\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  
  let match;
  let blockIndex = 0;

  while ((match = blockRegex.exec(diffContent)) !== null) {
    const startLineStr = match[1];
    const searchText = match[2];
    const replaceText = match[3];

    blocks.push({
      index: blockIndex++,
      startLineHint: startLineStr ? parseInt(startLineStr, 10) : undefined,
      searchText,
      replaceText,
    });
  }

  if (blocks.length === 0) {
    // Try to provide helpful feedback on what's wrong
    let hint = '';
    if (diffContent.includes('<<<')) {
      hint = '\n\nFound <<<, but block format is incorrect. ';
      if (!diffContent.includes('<<<<<<<')) {
        hint += 'Use exactly 7 "<" characters (found fewer).';
      } else if (!diffContent.includes('-------')) {
        hint += 'Missing "-------" separator (7 dashes).';
      } else if (!diffContent.includes('=======')) {
        hint += 'Missing "=======" separator (7 equals).';
      } else if (!diffContent.includes('>>>>>>>')) {
        hint += 'Missing ">>>>>>>" closing tag (7 ">" characters).';
      }
    } else {
      hint = '\n\nNo SEARCH/REPLACE block markers found at all. Did you mean to use edit_file instead?';
    }
    
    return {
      blocks: [],
      error: `DIFF_FORMAT_INVALID: No valid SEARCH/REPLACE blocks found.${hint}

Expected format:
<<<<<<< SEARCH
:start_line:10
-------
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE

Make sure to:
1. Use exactly 7 '<' and '>' characters for markers
2. Include '-------' separator (7 dashes) after SEARCH header
3. Include '=======' separator (7 equals) between search and replace
4. Include closing '>>>>>>> REPLACE' tag
5. :start_line: is optional but recommended

Your diff content (first 300 chars):
\`\`\`
${diffContent.substring(0, 300)}${diffContent.length > 300 ? '...' : ''}
\`\`\``,
    };
  }

  return { blocks };
}

/**
 * Validate search blocks to prevent common mistakes that cause loops
 */
function validateSearchBlocks(blocks: ParsedBlock[], filePath: string): { valid: boolean; error?: string } {
  for (const block of blocks) {
    const searchText = block.searchText;
    
    // Check if search text looks like it was copied from a read_file result with line numbers
    // Pattern: "1 | content" or "10 | content" at start of lines
    const hasLineNumbers = /^\d+ \| /m.test(searchText);
    if (hasLineNumbers) {
      return {
        valid: false,
        error: `SEARCH_TEXT_ERROR: Block ${block.index} contains line numbers ("X | content" format).

This happens when you copy from read_file output without removing the line numbers.

Your search text:
\`\`\`
${searchText}
\`\`\`

FIX: Remove the "X | " line number prefix from each line. The search text should contain ONLY the actual file content, not the line numbers that read_file displays.

Example - WRONG:
<<<<<<< SEARCH
10 | const x = 1;
11 | const y = 2;
=======

Example - CORRECT:
<<<<<<< SEARCH
const x = 1;
const y = 2;
=======`,
      };
    }
    
    // Check for very short/generic search text that's unlikely to be unique
    const trimmedSearch = searchText.trim();
    if (trimmedSearch.length < 3) {
      return {
        valid: false,
        error: `SEARCH_TEXT_ERROR: Block ${block.index} has very short search text (${trimmedSearch.length} characters).

Search text must be specific enough to uniquely identify the location to change. Very short text like "${trimmedSearch}" could match many places in the file.

Use read_file to find a unique section of code to search for, preferably at least a full line or statement.`,
      };
    }
    
    // Check if search text is just whitespace
    if (trimmedSearch.length === 0) {
      return {
        valid: false,
        error: `SEARCH_TEXT_ERROR: Block ${block.index} has empty search text.

You must specify what content to search for. Use read_file on ${filePath} to see the current content, then copy the exact text you want to replace.`,
      };
    }
    
    // Check if search text looks like it contains error messages or diagnostic output
    const errorPatterns = [
      /SEARCH_TEXT_ERROR:/i,
      /APPLY_DIFF_FAILED:/i,
      /SEARCH block \d+ not found/i,
      /Your SEARCH text:/i,
      /Actual file content/i,
      /Next steps:/i,
    ];
    
    for (const pattern of errorPatterns) {
      if (pattern.test(searchText)) {
        return {
          valid: false,
          error: `SEARCH_TEXT_ERROR: Block ${block.index} appears to contain an error message, not actual file content.

Your search text:
\`\`\`
${searchText.substring(0, 200)}...
\`\`\`

This looks like you copied text from a previous error message instead of from the actual file.

FIX: Use read_file on ${filePath} to get the actual file content, then copy the exact code you want to replace (not error messages).`,
        };
      }
    }
  }
  
  return { valid: true };
}

export class ApplyDiffTool implements ITool {
  name = 'apply_diff';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const diffContent = parameters.diff as string;
    const fuzzyThreshold = (parameters.fuzzy_threshold as number) || DEFAULT_FUZZY_THRESHOLD;

    console.log('[APPLY_DIFF] ==================== START ====================');
    console.log('[APPLY_DIFF] Target file:', filePath);
    console.log('[APPLY_DIFF] Fuzzy threshold:', fuzzyThreshold);

    if (!filePath) {
      console.log('[APPLY_DIFF] ERROR: No file path provided');
      return { success: false, error: 'File path is required' };
    }

    if (!diffContent) {
      console.log('[APPLY_DIFF] ERROR: No diff content provided');
      return { success: false, error: 'Diff content is required' };
    }

    // Parse blocks
    const parseResult = parseDiffBlocks(diffContent);
    if (parseResult.error) {
      console.log('[APPLY_DIFF] ERROR: Parse failed');
      return { success: false, error: parseResult.error };
    }

    const blocks = parseResult.blocks;
    console.log(`[APPLY_DIFF] Parsed ${blocks.length} SEARCH/REPLACE block(s)`);

    // Validate blocks to prevent common mistakes
    const validationResult = validateSearchBlocks(blocks, filePath);
    if (!validationResult.valid) {
      console.log('[APPLY_DIFF] ERROR: Validation failed');
      return { success: false, error: validationResult.error };
    }

    try {
      const workspaceRoot = getWorkspaceRoot();
      if (!workspaceRoot) {
        console.log('[APPLY_DIFF] ERROR: No workspace folder open');
        return { success: false, error: 'No workspace folder open' };
      }

      const absolutePath = resolveAbsolutePath(filePath, workspaceRoot);
      const uri = vscode.Uri.file(absolutePath);
      console.log('[APPLY_DIFF] Absolute path:', absolutePath);

      // Read file
      let originalContent: string;
      try {
        const fileContent = await vscode.workspace.fs.readFile(uri);
        originalContent = Buffer.from(fileContent).toString('utf8');
        console.log('[APPLY_DIFF] File read successfully, length:', originalContent.length, 'characters');
      } catch (error) {
        console.log('[APPLY_DIFF] ERROR: File not found:', error);
        return {
          success: false,
          error: `FILE_NOT_FOUND: Cannot read file '${filePath}'. Verify the path is correct.`,
        };
      }

      // Apply blocks sequentially
      let lines = originalContent.split(/\r?\n/);
      const blockResults: BlockResult[] = [];
      let appliedCount = 0;

      for (const block of blocks) {
        console.log(`[APPLY_DIFF] Processing block ${block.index}...`);
        
        const searchLines = block.searchText.split(/\r?\n/);
        const replaceLines = block.replaceText.split(/\r?\n/);
        
        // Determine search window
        let startIndex = 0;
        let endIndex = lines.length;
        
        if (block.startLineHint !== undefined && block.startLineHint > 0) {
          // Use hint with buffer
          const hintIndex = block.startLineHint - 1; // Convert 1-based to 0-based
          startIndex = Math.max(0, hintIndex - BUFFER_LINES);
          endIndex = Math.min(lines.length, hintIndex + searchLines.length + BUFFER_LINES);
          console.log(`[APPLY_DIFF] Block ${block.index}: Using start_line hint ${block.startLineHint}, searching lines ${startIndex + 1}-${endIndex}`);
        } else {
          console.log(`[APPLY_DIFF] Block ${block.index}: No start_line hint, searching entire file`);
        }

        // Try exact match first
        let matchIndex = -1;
        const searchChunk = searchLines.join('\n');
        
        for (let i = startIndex; i <= endIndex - searchLines.length; i++) {
          const candidateLines = lines.slice(i, i + searchLines.length);
          const candidateChunk = candidateLines.join('\n');
          
          if (candidateChunk === searchChunk) {
            matchIndex = i;
            console.log(`[APPLY_DIFF] Block ${block.index}: Exact match found at line ${i + 1}`);
            break;
          }
        }

        // If no exact match, try fuzzy search
        let similarity = 1.0;
        if (matchIndex === -1) {
          console.log(`[APPLY_DIFF] Block ${block.index}: No exact match, trying fuzzy search...`);
          const fuzzyResult = fuzzySearch(lines, searchChunk, startIndex, endIndex);
          
          if (fuzzyResult.bestScore >= fuzzyThreshold) {
            matchIndex = fuzzyResult.bestMatchIndex;
            similarity = fuzzyResult.bestScore;
            console.log(`[APPLY_DIFF] Block ${block.index}: Fuzzy match found at line ${matchIndex + 1} (similarity: ${(similarity * 100).toFixed(1)}%)`);
          } else {
            console.log(`[APPLY_DIFF] Block ${block.index}: No match found (best similarity: ${(fuzzyResult.bestScore * 100).toFixed(1)}%)`);
          }
        }

        // Apply replacement if match found
        if (matchIndex >= 0) {
          // Remove old lines and insert new ones
          lines.splice(matchIndex, searchLines.length, ...replaceLines);
          appliedCount++;
          
          blockResults.push({
            index: block.index,
            applied: true,
            similarity: similarity < 1.0 ? similarity : undefined,
            matchedLine: matchIndex + 1,
          });
          
          console.log(`[APPLY_DIFF] Block ${block.index}: Applied successfully`);
        } else {
          // Provide detailed error with file context
          let errorMsg: string;
          let contextLines: string = '';
          
          if (block.startLineHint !== undefined && block.startLineHint > 0) {
            // Show actual content near the hint
            const contextStart = Math.max(0, block.startLineHint - 1 - 3);
            const contextEnd = Math.min(lines.length, block.startLineHint - 1 + searchLines.length + 3);
            const contextArray = lines.slice(contextStart, contextEnd);
            contextLines = contextArray.map((line, idx) => `${contextStart + idx + 1} | ${line}`).join('\n');
            
            errorMsg = `SEARCH block ${block.index} not found near line ${block.startLineHint}.

Your SEARCH text:
\`\`\`
${block.searchText}
\`\`\`

Actual file content near line ${block.startLineHint}:
\`\`\`
${contextLines}
\`\`\`

The search text doesn't match the file. Possible issues:
1. Content has changed since you last read the file
2. Whitespace/indentation doesn't match exactly
3. Line ${block.startLineHint} is not where this code is located

Next steps:
- Use read_file to see current content with line numbers
- Copy the EXACT text from read_file output (including whitespace)
- Verify the :start_line: points to the first line of your search text`;
          } else {
            // No hint provided - search entire file failed
            errorMsg = `SEARCH block ${block.index} not found anywhere in the file.

Your SEARCH text:
\`\`\`
${block.searchText}
\`\`\`

This text doesn't exist in ${filePath}.

Next steps:
- Use read_file on ${filePath} to see actual content
- Copy EXACT text from the file (watch for whitespace/indentation)
- Include a :start_line: hint with the line number from read_file`;
          }
          
          blockResults.push({
            index: block.index,
            applied: false,
            error: errorMsg,
          });
          
          console.log(`[APPLY_DIFF] Block ${block.index}: Failed - ${errorMsg}`);
        }
      }

      // Check if any blocks were applied
      if (appliedCount === 0) {
        const errors = blockResults
          .filter(r => !r.applied)
          .map(r => r.error)
          .join('\n\n---\n\n');
        
        console.log('[APPLY_DIFF] ERROR: No blocks applied');
        return {
          success: false,
          error: `APPLY_DIFF_FAILED: None of the ${blocks.length} SEARCH/REPLACE block(s) could be applied to ${filePath}.\n\n${errors}\n\n⚠️ CRITICAL: Do NOT retry with the same search text. The file content is different than what you're searching for. You MUST use read_file first to see the current state.`,
        };
      }

      // Join lines back to content
      const newContent = lines.join('\n');
      console.log('[APPLY_DIFF] New content length:', newContent.length, 'characters');
      console.log(`[APPLY_DIFF] Applied ${appliedCount}/${blocks.length} block(s)`);

      // Write file
      const contentBytes = Buffer.from(newContent, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);
      console.log('[APPLY_DIFF] File written successfully');

      // Capture diagnostics
      const diagnosticsService = DiagnosticsService.getInstance();
      let diagnostics: CapturedDiagnostic[] = [];
      if (diagnosticsService.isEnabled()) {
        try {
          diagnostics = await diagnosticsService.captureDiagnosticsForFile(absolutePath, {
            delay: diagnosticsService.getConfig('delay', 800),
            timeout: diagnosticsService.getConfig('timeout', 5000),
          });
          console.log(`[APPLY_DIFF] Captured ${diagnostics.length} diagnostics`);
        } catch (diagError) {
          console.warn('[APPLY_DIFF] Failed to capture diagnostics:', diagError);
        }
      }

      // Truncate for return if too large
      const MAX_CONTENT_SIZE = 1024 * 512; // 512KB
      let returnOriginal = originalContent;
      let returnNew = newContent;
      let truncated = false;

      if (originalContent.length > MAX_CONTENT_SIZE || newContent.length > MAX_CONTENT_SIZE) {
        returnOriginal = originalContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        returnNew = newContent.substring(0, MAX_CONTENT_SIZE) + '\n...(truncated)...';
        truncated = true;
      }

      // Prepare warning for partial application
      let warning: string | undefined;
      if (appliedCount < blocks.length) {
        const successfulBlocks = blockResults.filter(r => r.applied).map(r => r.index);
        const failedBlocks = blockResults
          .filter(r => !r.applied)
          .map(r => r.error)
          .join('\n\n---\n\n');
        warning = `⚠️ PARTIAL SUCCESS: Applied ${appliedCount}/${blocks.length} blocks to ${filePath}.

✅ Successfully applied blocks: ${successfulBlocks.join(', ')}
❌ Failed blocks: ${blockResults.filter(r => !r.applied).map(r => r.index).join(', ')}

IMPORTANT: The file HAS been modified by the successful blocks.

Failed blocks:
${failedBlocks}

Next steps:
1. Use read_file on ${filePath} to see the CURRENT state (after successful changes)
2. Find the correct location and content for the failed blocks
3. Create a NEW apply_diff with ONLY the failed blocks, using updated search text
4. Do NOT retry the successful blocks (${successfulBlocks.join(', ')}) - they already worked!`;
      }

      console.log('[APPLY_DIFF] ==================== SUCCESS ====================');
      return {
        success: true,
        data: {
          path: filePath,
          originalContent: returnOriginal,
          newContent: returnNew,
          truncated,
          stats: {
            blocksTotal: blocks.length,
            blocksApplied: appliedCount,
            blocksFailed: blocks.length - appliedCount,
          },
          blockResults,
          warning,
          diagnostics,
        },
      };
    } catch (error) {
      console.error('[APPLY_DIFF] ==================== EXCEPTION ====================');
      console.error('[APPLY_DIFF] Exception:', error);
      return {
        success: false,
        error: `APPLY_DIFF_FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
