import * as childProcess from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { EXCLUDED_DIRECTORIES, EXCLUDED_FILES } from '../../constants/excluded-patterns';

/**
 * Ripgrep service for Echode
 * Ported from Roo Code's implementation for fast regex search using native ripgrep binary.
 * 
 * Key features:
 * - Uses VSCode's bundled ripgrep binary
 * - JSON output parsing for structured results
 * - Context lines support
 * - Gitignore-aware by default
 * - Uses excluded-patterns.ts for comprehensive exclusion list
 */

const isWindows = process.platform.startsWith('win');
const binName = isWindows ? 'rg.exe' : 'rg';

// Constants
const MAX_RESULTS = 300;
const MAX_LINE_LENGTH = 500;

interface SearchFileResult {
    file: string;
    searchResults: SearchResult[];
}

interface SearchResult {
    lines: SearchLineResult[];
}

interface SearchLineResult {
    line: number;
    text: string;
    isMatch: boolean;
    column?: number;
}

// Structured result format for frontend UI rendering
export interface GrepMatch {
    line: number;
    column: number;
    text: string;
    matchText: string;
}

export interface GrepFileResult {
    file: string;
    matches: GrepMatch[];
}

export interface GrepSearchResult {
    results: GrepFileResult[];
    formattedString: string;
    totalMatches: number;
    filesWithMatches: number;
}

/**
 * Helper function to check if a path exists.
 */
async function fileExistsAtPath(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

/**
 * Truncates a line if it exceeds the maximum length
 */
export function truncateLine(line: string, maxLength: number = MAX_LINE_LENGTH): string {
    return line.length > maxLength ? line.substring(0, maxLength) + ' [truncated...]' : line;
}

/**
 * Get the path to the ripgrep binary within the VSCode installation
 */
export async function getBinPath(vscodeAppRoot: string): Promise<string | undefined> {
    const checkPath = async (pkgFolder: string) => {
        const fullPath = path.join(vscodeAppRoot, pkgFolder, binName);
        return (await fileExistsAtPath(fullPath)) ? fullPath : undefined;
    };

    return (
        (await checkPath('node_modules/@vscode/ripgrep/bin/')) ||
        (await checkPath('node_modules/vscode-ripgrep/bin')) ||
        (await checkPath('node_modules.asar.unpacked/vscode-ripgrep/bin/')) ||
        (await checkPath('node_modules.asar.unpacked/@vscode/ripgrep/bin/'))
    );
}

/**
 * Execute ripgrep command and return output
 */
async function execRipgrep(bin: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const rgProcess = childProcess.spawn(bin, args);
        const rl = readline.createInterface({
            input: rgProcess.stdout,
            crlfDelay: Infinity,
        });

        let output = '';
        let lineCount = 0;
        const maxLines = MAX_RESULTS * 5;

        rl.on('line', (line) => {
            if (lineCount < maxLines) {
                output += line + '\n';
                lineCount++;
            } else {
                rl.close();
                rgProcess.kill();
            }
        });

        let errorOutput = '';
        rgProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        rl.on('close', () => {
            if (errorOutput && output.length === 0) {
                reject(new Error(`ripgrep process error: ${errorOutput}`));
            } else {
                resolve(output);
            }
        });

        rgProcess.on('error', (error) => {
            reject(new Error(`ripgrep process error: ${error.message}`));
        });
    });
}

/**
 * Perform regex search on files using ripgrep
 * 
 * @param cwd - Current working directory (for relative path calculation)
 * @param directoryPath - The directory to search in
 * @param regex - The regular expression to search for (Rust regex syntax)
 * @param filePattern - Optional glob pattern to filter files
 * @returns Formatted string containing search results with context
 */
export async function regexSearchFiles(
    cwd: string,
    directoryPath: string,
    regex: string,
    filePattern?: string,
): Promise<string> {
    const vscodeAppRoot = vscode.env.appRoot;
    const rgPath = await getBinPath(vscodeAppRoot);

    if (!rgPath) {
        throw new Error('Could not find ripgrep binary');
    }

    const args = ['--json', '-e', regex];

    // Add default directory excludes from excluded-patterns.ts
    for (const dir of EXCLUDED_DIRECTORIES) {
        args.push('-g', `!**/${dir}/**`);
    }

    // Add default file excludes from excluded-patterns.ts
    for (const file of EXCLUDED_FILES) {
        args.push('-g', `!${file}`);
    }

    // Only add --glob if a specific file pattern is provided
    // Using --glob "*" overrides .gitignore behavior, so we omit it when no pattern is specified
    if (filePattern) {
        args.push('--glob', filePattern);
    }

    args.push('--context', '1', '--no-messages', directoryPath);

    console.log('[GREP] Ripgrep args:', args.join(' '));

    let output: string;
    try {
        output = await execRipgrep(rgPath, args);
        console.log('[GREP] Ripgrep output length:', output.length);
        console.log('[GREP] Ripgrep output preview:', output.substring(0, 500));
    } catch (error) {
        console.error('[GREP] Error executing ripgrep:', error);
        return 'No results found';
    }

    const results: SearchFileResult[] = [];
    let currentFile: SearchFileResult | null = null;

    output.split('\n').forEach((line) => {
        if (line) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'begin') {
                    currentFile = {
                        file: parsed.data.path.text.toString(),
                        searchResults: [],
                    };
                } else if (parsed.type === 'end') {
                    if (currentFile) {
                        results.push(currentFile);
                        currentFile = null;
                    }
                } else if ((parsed.type === 'match' || parsed.type === 'context') && currentFile) {
                    const lineData = {
                        line: parsed.data.line_number,
                        text: truncateLine(parsed.data.lines.text),
                        isMatch: parsed.type === 'match',
                        ...(parsed.type === 'match' && { column: parsed.data.absolute_offset }),
                    };

                    const lastResult = currentFile.searchResults[currentFile.searchResults.length - 1];
                    if (lastResult?.lines.length > 0) {
                        const lastLine = lastResult.lines[lastResult.lines.length - 1];

                        // If this line is contiguous with the last result, add to it
                        if (parsed.data.line_number <= lastLine.line + 1) {
                            lastResult.lines.push(lineData);
                        } else {
                            // Otherwise create a new result
                            currentFile.searchResults.push({
                                lines: [lineData],
                            });
                        }
                    } else {
                        // First line in file
                        currentFile.searchResults.push({
                            lines: [lineData],
                        });
                    }
                }
            } catch (error) {
                console.error('[GREP] Error parsing ripgrep output line:', error);
            }
        }
    });

    console.log('[GREP] Parsed results:', results.length, 'files');

    return formatResults(results, cwd);
}

/**
 * Format search results into a readable string
 */
function formatResults(fileResults: SearchFileResult[], cwd: string): string {
    const groupedResults: { [key: string]: SearchResult[] } = {};

    const totalResults = fileResults.reduce((sum, file) => sum + file.searchResults.length, 0);
    let output = '';

    if (totalResults >= MAX_RESULTS) {
        output += `Showing first ${MAX_RESULTS} of ${MAX_RESULTS}+ results. Use a more specific search if necessary.\n\n`;
    } else {
        output += `Found ${totalResults === 1 ? '1 result' : `${totalResults.toLocaleString()} results`}.\n\n`;
    }

    // Group results by file name
    fileResults.slice(0, MAX_RESULTS).forEach((file) => {
        const relativeFilePath = path.relative(cwd, file.file);
        if (!groupedResults[relativeFilePath]) {
            groupedResults[relativeFilePath] = [];
            groupedResults[relativeFilePath].push(...file.searchResults);
        }
    });

    for (const [filePath, results] of Object.entries(groupedResults)) {
        // Convert backslashes to forward slashes for consistent display
        output += `# ${filePath.replace(/\\/g, '/')}\n`;

        results.forEach((result) => {
            if (result.lines.length > 0) {
                result.lines.forEach((line) => {
                    const lineNumber = String(line.line).padStart(3, ' ');
                    output += `${lineNumber} | ${line.text.trimEnd()}\n`;
                });
                output += '----\n';
            }
        });

        output += '\n';
    }

    return output.trim();
}

/**
 * Convert internal SearchFileResult to structured GrepFileResult for frontend
 */
function toStructuredResults(fileResults: SearchFileResult[], cwd: string, query: string): GrepFileResult[] {
    return fileResults.map((file) => {
        const relativeFilePath = path.relative(cwd, file.file).replace(/\\/g, '/');
        const matches: GrepMatch[] = [];

        file.searchResults.forEach((result) => {
            result.lines.forEach((line) => {
                if (line.isMatch) {
                    matches.push({
                        line: line.line,
                        column: line.column || 0,
                        text: line.text.trimEnd(),
                        matchText: query,
                    });
                }
            });
        });

        return {
            file: relativeFilePath,
            matches,
        };
    }).filter(file => file.matches.length > 0);
}

/**
 * Perform regex search on files using ripgrep - returns structured results for UI
 * 
 * @param cwd - Current working directory (for relative path calculation)
 * @param directoryPath - The directory to search in
 * @param regex - The regular expression to search for (Rust regex syntax)
 * @param filePattern - Optional glob pattern to filter files
 * @returns Structured search results with both UI-friendly array and formatted string
 */
export async function regexSearchFilesStructured(
    cwd: string,
    directoryPath: string,
    regex: string,
    filePattern?: string,
): Promise<GrepSearchResult> {
    const vscodeAppRoot = vscode.env.appRoot;
    const rgPath = await getBinPath(vscodeAppRoot);

    if (!rgPath) {
        throw new Error('Could not find ripgrep binary');
    }

    const args = ['--json', '-e', regex];

    // Add default directory excludes from excluded-patterns.ts
    for (const dir of EXCLUDED_DIRECTORIES) {
        args.push('-g', `!**/${dir}/**`);
    }

    // Add default file excludes from excluded-patterns.ts
    for (const file of EXCLUDED_FILES) {
        args.push('-g', `!${file}`);
    }

    // Only add --glob if a specific file pattern is provided
    if (filePattern) {
        args.push('--glob', filePattern);
    }

    args.push('--context', '1', '--no-messages', directoryPath);

    let output: string;
    try {
        output = await execRipgrep(rgPath, args);
    } catch (error) {
        console.error('[GREP] Error executing ripgrep:', error);
        return {
            results: [],
            formattedString: 'No results found',
            totalMatches: 0,
            filesWithMatches: 0,
        };
    }

    const results: SearchFileResult[] = [];
    let currentFile: SearchFileResult | null = null;

    output.split('\n').forEach((line) => {
        if (line) {
            try {
                const parsed = JSON.parse(line);
                if (parsed.type === 'begin') {
                    currentFile = {
                        file: parsed.data.path.text.toString(),
                        searchResults: [],
                    };
                } else if (parsed.type === 'end') {
                    if (currentFile) {
                        results.push(currentFile);
                        currentFile = null;
                    }
                } else if ((parsed.type === 'match' || parsed.type === 'context') && currentFile) {
                    const lineData = {
                        line: parsed.data.line_number,
                        text: truncateLine(parsed.data.lines.text),
                        isMatch: parsed.type === 'match',
                        ...(parsed.type === 'match' && { column: parsed.data.absolute_offset }),
                    };

                    const lastResult = currentFile.searchResults[currentFile.searchResults.length - 1];
                    if (lastResult?.lines.length > 0) {
                        const lastLine = lastResult.lines[lastResult.lines.length - 1];

                        if (parsed.data.line_number <= lastLine.line + 1) {
                            lastResult.lines.push(lineData);
                        } else {
                            currentFile.searchResults.push({
                                lines: [lineData],
                            });
                        }
                    } else {
                        currentFile.searchResults.push({
                            lines: [lineData],
                        });
                    }
                }
            } catch (error) {
                console.error('[GREP] Error parsing ripgrep output line:', error);
            }
        }
    });

    const structuredResults = toStructuredResults(results, cwd, regex);
    const totalMatches = structuredResults.reduce((sum, file) => sum + file.matches.length, 0);

    return {
        results: structuredResults,
        formattedString: formatResults(results, cwd),
        totalMatches,
        filesWithMatches: structuredResults.length,
    };
}

/**
 * Execute ripgrep to list files (for glob search)
 */
export async function listFilesWithRipgrep(
    workspacePath: string,
    options: {
        limit?: number;
        globPatterns?: string[];
        excludePatterns?: string[];
    } = {}
): Promise<{ path: string; type: 'file' | 'folder'; label?: string }[]> {
    const { limit = 500, globPatterns = [], excludePatterns = [] } = options;

    const rgPath = await getBinPath(vscode.env.appRoot);

    if (!rgPath) {
        throw new Error('Could not find ripgrep binary');
    }

    const args = [
        '--files',
        '--follow',
        '--hidden',
    ];

    // Add default directory excludes from excluded-patterns.ts
    for (const dir of EXCLUDED_DIRECTORIES) {
        args.push('-g', `!**/${dir}/**`);
    }

    // Add default file excludes from excluded-patterns.ts
    for (const file of EXCLUDED_FILES) {
        args.push('-g', `!${file}`);
    }

    // Add custom exclude patterns
    for (const pattern of excludePatterns) {
        args.push('-g', `!${pattern}`);
    }

    // Add include glob patterns
    for (const pattern of globPatterns) {
        args.push('-g', pattern);
    }

    args.push(workspacePath);

    return new Promise((resolve, reject) => {
        const rgProcess = childProcess.spawn(rgPath, args);
        const rl = readline.createInterface({ input: rgProcess.stdout, crlfDelay: Infinity });
        const fileResults: { path: string; type: 'file' | 'folder'; label?: string }[] = [];
        const dirSet = new Set<string>();

        let count = 0;

        rl.on('line', (line) => {
            if (count < limit) {
                try {
                    const relativePath = path.relative(workspacePath, line);

                    fileResults.push({
                        path: relativePath.replace(/\\/g, '/'),
                        type: 'file',
                        label: path.basename(relativePath)
                    });

                    // Extract and store all parent directory paths
                    let dirPath = path.dirname(relativePath);
                    while (dirPath && dirPath !== '.' && dirPath !== '/') {
                        dirSet.add(dirPath);
                        dirPath = path.dirname(dirPath);
                    }

                    count++;
                } catch {
                    // Silently ignore errors processing individual paths
                }
            } else {
                rl.close();
                rgProcess.kill();
            }
        });

        let errorOutput = '';
        rgProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        rl.on('close', () => {
            if (errorOutput && fileResults.length === 0) {
                reject(new Error(`ripgrep process error: ${errorOutput}`));
            } else {
                // Convert directory set to array of directory objects
                const dirResults = Array.from(dirSet).map((dirPath) => ({
                    path: dirPath.replace(/\\/g, '/'),
                    type: 'folder' as const,
                    label: path.basename(dirPath),
                }));

                resolve([...fileResults, ...dirResults]);
            }
        });

        rgProcess.on('error', (error) => {
            reject(new Error(`ripgrep process error: ${error.message}`));
        });
    });
}
