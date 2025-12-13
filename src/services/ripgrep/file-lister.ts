/**
 * Ripgrep file listing functionality
 */

import * as childProcess from 'child_process';
import * as path from 'path';
import * as readline from 'readline';
import * as vscode from 'vscode';
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