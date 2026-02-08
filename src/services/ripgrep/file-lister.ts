/**
 * Ripgrep file listing functionality
 */

import * as childProcess from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { getBinPath } from './binary-resolver';

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

    // All exclusions handled by ripgrep's native .gitignore support

    // Add custom exclude patterns
    for (const pattern of excludePatterns) {
        args.push('-g', `!${pattern}`);
    }

    // Add include glob patterns
    // Normalize patterns: add **/ prefix if not present to match anywhere in tree
    // This matches user expectation that "resources/*.json" finds files in any "resources" folder
    for (const pattern of globPatterns) {
        let normalizedPattern = pattern;
        
        // Only add **/ if pattern doesn't already have a glob prefix or absolute indicator
        if (!pattern.startsWith('**/') && !pattern.startsWith('/') && !pattern.startsWith('!')) {
            normalizedPattern = `**/${pattern}`;
        }
        
        args.push('-g', normalizedPattern);
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

        rl.on('close', async () => {
            if (errorOutput && fileResults.length === 0) {
                reject(new Error(`ripgrep process error: ${errorOutput}`));
            } else {
                // Convert directory set to array of directory objects
                const dirResults = Array.from(dirSet).map((dirPath) => ({
                    path: dirPath.replace(/\\/g, '/'),
                    type: 'folder' as const,
                    label: path.basename(dirPath),
                }));

                // Also search for directories that match glob patterns
                const matchingDirs = await findMatchingDirectories(workspacePath, globPatterns, excludePatterns, limit);

                resolve([...fileResults, ...dirResults, ...matchingDirs]);
            }
        });

        rgProcess.on('error', (error) => {
            reject(new Error(`ripgrep process error: ${error.message}`));
        });
    });
}

async function findMatchingDirectories(
    workspacePath: string,
    globPatterns: string[],
    excludePatterns: string[],
    limit: number
): Promise<{ path: string; type: 'folder'; label: string }[]> {
    const results: { path: string; type: 'folder'; label: string }[] = [];
    const seenDirs = new Set<string>();

    // Normalize patterns for directory matching
    const normalizedPatterns = globPatterns.map(pattern => {
        // Remove **/ and */ prefixes for directory name matching
        let p = pattern;
        if (p.startsWith('**/')) { p = p.slice(3); }
        if (p.startsWith('*/')) { p = p.slice(2); }
        // Remove trailing wildcards
        if (p.endsWith('*')) { p = p.slice(0, -1); }
        if (p.endsWith('/*')) { p = p.slice(0, -2); }
        return p;
    }).filter(p => p.length > 0 && !p.includes('*'));

    if (normalizedPatterns.length === 0) {
        return results;
    }

    async function scanDir(dirPath: string, relativePath: string) {
        if (results.length >= limit) { return; }

        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!entry.isDirectory()) { continue; }

                const entryRelativePath = relativePath 
                    ? `${relativePath}/${entry.name}` 
                    : entry.name;
                
                // Check if this directory name matches any pattern
                const matchesPattern = normalizedPatterns.some(pattern => {
                    // Match exact folder name or full path ending
                    return entry.name === pattern || 
                           entryRelativePath === pattern ||
                           entryRelativePath.endsWith(`/${pattern}`);
                });

                // Check if excluded
                const isExcluded = excludePatterns.some(exclude => {
                    return entry.name === exclude || 
                           entryRelativePath.includes(exclude.replace('**/', '').replace('*/', ''));
                });

                if (matchesPattern && !isExcluded && !seenDirs.has(entryRelativePath)) {
                    seenDirs.add(entryRelativePath);
                    results.push({
                        path: entryRelativePath,
                        type: 'folder',
                        label: entry.name
                    });
                }

                // Recurse into subdirectory (even if it matched, scan deeper)
                if (!isExcluded && results.length < limit) {
                    await scanDir(path.join(dirPath, entry.name), entryRelativePath);
                }
            }
        } catch {
            // Ignore permission errors etc
        }
    }

    await scanDir(workspacePath, '');
    return results;
}