import * as vscode from 'vscode';
import * as path from 'path';

export interface ResolvedPath {
    /**
     * The fully resolved VS Code URI for the target file
     */
    uri: vscode.Uri;
    /**
     * The absolute file system path (convenience for legacy APIs)
     */
    absolutePath: string;
    /**
     * The workspace folder this path belongs to (context)
     */
    workspaceFolder: vscode.WorkspaceFolder;
    /**
     * The path relative to the workspace folder
     */
    relativePath: string;
}

export class PathResolver {
    /**
     * Resolves a user-provided path string to a concrete workspace location.
     * Handles:
     * - Absolute paths (validates they are inside a workspace)
     * - Multi-root prefixes ("ProjectName/path/to/file")
     * - Relative paths (defaults to primary workspace)
     * 
     * @param userPath The path string provided by the AI or user
     * @returns Resolved path details with correct workspace context
     * @throws Error if no workspace is open
     */
    public static resolve(userPath: string): ResolvedPath {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            throw new Error('No workspace folder open');
        }

        // 1. Handle Absolute Paths
        if (path.isAbsolute(userPath)) {
            // Find which workspace contains this path
            const normalizedPath = path.normalize(userPath);
            // Sort by length desc to match longest (most specific) root first
            const sortedFolders = [...folders].sort((a, b) => b.uri.fsPath.length - a.uri.fsPath.length);
            
            const matchedFolder = sortedFolders.find(f => {
                const normalizedRoot = path.normalize(f.uri.fsPath);
                return normalizedPath.startsWith(normalizedRoot + path.sep) || normalizedPath === normalizedRoot;
            });

            // Security: If absolute path is outside all workspaces, force it to primary root
            // (Or typically we might throw, but to preserve legacy behavior we default to first)
            const targetFolder = matchedFolder || folders[0];
            
            // If it was outside, we re-root it? 
            // Legacy behavior: `resolveAbsolutePath` warned and returned root.
            // Let's replicate safe behavior:
            if (!matchedFolder) {
                console.warn(`[PathResolver] Blocked access to path outside workspace: ${userPath}`);
                return {
                    uri: targetFolder.uri,
                    absolutePath: targetFolder.uri.fsPath,
                    workspaceFolder: targetFolder,
                    relativePath: ''
                };
            }

            return {
                uri: vscode.Uri.file(normalizedPath),
                absolutePath: normalizedPath,
                workspaceFolder: targetFolder,
                relativePath: path.relative(targetFolder.uri.fsPath, normalizedPath)
            };
        }

        // 2. Handle Multi-Root Prefixes ("ProjectName/...")
        // We check this even for single-root workspaces because the AI might be following
        // system prompt instructions to always prefix paths with the project name.
        const parts = userPath.split(/[/\\]/);
        const potentialPrefix = parts[0];
        
        const matchedFolder = folders.find(f => f.name === potentialPrefix);
        if (matchedFolder) {
            // Strip the prefix
            const relPath = parts.slice(1).join(path.sep);
            const uri = vscode.Uri.joinPath(matchedFolder.uri, relPath);
            return {
                uri,
                absolutePath: uri.fsPath,
                workspaceFolder: matchedFolder,
                relativePath: relPath
            };
        }

        // 3. Default Relative Path (Primary Workspace)
        const primary = folders[0];
        const uri = vscode.Uri.joinPath(primary.uri, userPath);
        
        return {
            uri,
            absolutePath: uri.fsPath,
            workspaceFolder: primary,
            relativePath: userPath
        };
    }
}