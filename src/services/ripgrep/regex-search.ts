/**
 * Ripgrep regex search functions
 */

import * as vscode from 'vscode';
import { GrepSearchResult } from './types';
import { getBinPath, fileExistsAtPath } from './binary-resolver';
import { execRipgrep } from './process-executor';
import { parseRipgrepJsonOutput } from './output-parser';
import { formatResults, toStructuredResults } from './result-formatter';

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

    // Validate that the search directory exists
    const directoryExists = await fileExistsAtPath(directoryPath);
    if (!directoryExists) {
        console.warn(`[GREP] Search path does not exist: ${directoryPath}`);
        return `Error: Search path "${directoryPath}" does not exist. Use a valid directory path like "src" or "." for the whole workspace.`;
    }

    const args = ['--json', '-e', regex];

    // All exclusions handled by ripgrep's native .gitignore support

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

    const results = parseRipgrepJsonOutput(output);

    console.log('[GREP] Parsed results:', results.length, 'files');

    return formatResults(results, cwd);
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

    // Validate that the search directory exists
    const directoryExists = await fileExistsAtPath(directoryPath);
    if (!directoryExists) {
        console.warn(`[GREP] Search path does not exist: ${directoryPath}`);
        return {
            results: [],
            formattedString: `Error: Search path "${directoryPath}" does not exist. Use a valid directory path like "src" or "." for the whole workspace.`,
            totalMatches: 0,
            filesWithMatches: 0,
        };
    }

    const args = ['--json', '-e', regex];

    // All exclusions handled by ripgrep's native .gitignore support

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

    const results = parseRipgrepJsonOutput(output);
    const structuredResults = toStructuredResults(results, cwd, regex);
    const totalMatches = structuredResults.reduce((sum, file) => sum + file.matches.length, 0);

    return {
        results: structuredResults,
        formattedString: formatResults(results, cwd),
        totalMatches,
        filesWithMatches: structuredResults.length,
    };
}