/**
 * Ripgrep binary path resolution
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { binName } from './constants';

/**
 * Helper function to check if a path exists.
 */
export async function fileExistsAtPath(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
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