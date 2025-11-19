import * as vscode from 'vscode';
import * as path from 'path';
import { ITool, ToolExecutionResult } from './tool.interface';

export class ReadFileTool implements ITool {
  name = 'read_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const startLine = parameters.startLine as number | undefined;
    const endLine = parameters.endLine as number | undefined;

    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return { success: false, error: 'No workspace folder open' };
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceRoot, filePath);

      const uri = vscode.Uri.file(absolutePath);

      // Check if path is a directory
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type === vscode.FileType.Directory) {
          return {
            success: false,
            error: `Cannot read directory '${filePath}'. Please use 'list_files' to view directory contents.`,
          };
        }
      } catch (error) {
        // If stat fails (e.g. file not found), readFile will handle the error appropriate
      }

      const fileContent = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(fileContent).toString('utf8');

      // If line range is specified, extract those lines
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = startLine ? Math.max(0, startLine - 1) : 0;
        const end = endLine ? Math.min(lines.length, endLine) : lines.length;
        const selectedLines = lines.slice(start, end);
        
        // Return raw content without line numbers
        const formattedContent = selectedLines.join('\n');

        return {
          success: true,
          data: {
            path: filePath,
            content: formattedContent,
            startLine: start + 1,
            endLine: end,
            totalLines: lines.length,
          },
        };
      }

      // Return full raw content
      return {
        success: true,
        data: {
          path: filePath,
          content: content,
          totalLines: content.split('\n').length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export class WriteFileTool implements ITool {
  name = 'write_file';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const filePath = parameters.path as string;
    const content = parameters.content as string;

    if (!filePath) {
      return { success: false, error: 'File path is required' };
    }

    if (content === undefined) {
      return { success: false, error: 'Content is required' };
    }

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return { success: false, error: 'No workspace folder open' };
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceRoot, filePath);

      const uri = vscode.Uri.file(absolutePath);
      
      // Check if file exists and capture old content
      let oldContent: string | null = null;
      let fileExisted = false;
      try {
        const oldFileContent = await vscode.workspace.fs.readFile(uri);
        oldContent = Buffer.from(oldFileContent).toString('utf8');
        fileExisted = true;
      } catch {
        // File doesn't exist, this is a new file
        fileExisted = false;
      }
      
      // Create parent directories if needed
      const dirPath = path.dirname(absolutePath);
      const dirUri = vscode.Uri.file(dirPath);
      try {
        await vscode.workspace.fs.createDirectory(dirUri);
      } catch {
        // Directory might already exist
      }

      // Write new content
      const contentBytes = Buffer.from(content, 'utf8');
      await vscode.workspace.fs.writeFile(uri, contentBytes);

      return {
        success: true,
        data: {
          path: filePath,
          action: fileExisted ? 'modified' : 'created',
          oldContent: oldContent,
          newContent: content,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

export class ListFilesTool implements ITool {
  name = 'list_files';

  async execute(parameters: Record<string, unknown>): Promise<ToolExecutionResult> {
    const dirPath = (parameters.path as string) || '';

    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        return { success: false, error: 'No workspace folder open' };
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      const absolutePath = dirPath
        ? path.isAbsolute(dirPath)
          ? dirPath
          : path.join(workspaceRoot, dirPath)
        : workspaceRoot;

      const uri = vscode.Uri.file(absolutePath);
      const entries = await vscode.workspace.fs.readDirectory(uri);

      const files: Array<{ name: string; type: string }> = [];
      const directories: Array<{ name: string; type: string }> = [];

      for (const [name, fileType] of entries) {
        // Skip hidden files/folders
        if (name.startsWith('.')) {
          continue;
        }

        if (fileType === vscode.FileType.Directory) {
          directories.push({ name, type: 'directory' });
        } else if (fileType === vscode.FileType.File) {
          files.push({ name, type: 'file' });
        }
      }

      // Sort alphabetically
      files.sort((a, b) => a.name.localeCompare(b.name));
      directories.sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: {
          path: dirPath || '/',
          directories,
          files,
          totalCount: files.length + directories.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
