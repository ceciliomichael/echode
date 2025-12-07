import { GrepSearchTool } from '../tools/grep-search-tool';
import { GlobSearchTool } from '../tools/glob-search-tool';
import { ReadFileTool } from '../tools/read-file-tool';
import { ListFilesTool } from '../tools/list-files-tool';
import { SearchStats, DiscoveredFileInfo } from './types';

/**
 * Base interface for tool executors
 */
interface ToolExecutorStrategy {
  execute(params: Record<string, string>, stats: SearchStats, discoveredFiles: Map<string, DiscoveredFileInfo>): Promise<string>;
}

/**
 * Grep search tool executor
 */
export class GrepSearchExecutor implements ToolExecutorStrategy {
  private tool = new GrepSearchTool();
  private static readonly MAX_FILES = 100;

  async execute(
    params: Record<string, string>,
    stats: SearchStats,
    discoveredFiles: Map<string, DiscoveredFileInfo>
  ): Promise<string> {
    stats.grepCalls++;

    const iteration = stats.iterations;
    const isEarlyIteration = iteration <= 2;
    const baseMaxFiles = GrepSearchExecutor.MAX_FILES;
    const baseMaxResults = 50;

    const maxResults = isEarlyIteration ? baseMaxResults : Math.min(baseMaxResults * 2, 100);
    const maxFiles = isEarlyIteration ? baseMaxFiles : Math.min(baseMaxFiles * 1.5, 200);

    const result = await this.tool.execute({
      query: params.query,
      path: params.path || '',
      includes: params.includes,
      maxResults,
      maxFiles,
      contextLines: 1,
      skipIndexing: true,
    });

    if (result.success && result.data) {
      const data = result.data as {
        totalMatches?: number;
        filesWithMatches?: number;
        results?: Array<{ file: string; matches: Array<{ line: number; text: string }> }>;
      };

      stats.totalMatches += data.totalMatches || 0;
      stats.filesScanned += data.filesWithMatches || 0;

      if (data.results && data.results.length > 0) {
        let output = `Found ${data.totalMatches} matches in ${data.filesWithMatches} files:\n`;

        const maxFilesToShow = 10;
        const maxMatchesPerFile = 5;

        for (const file of data.results.slice(0, maxFilesToShow)) {
          output += `\n## ${file.file}\n`;

          const matches = file.matches.slice(0, maxMatchesPerFile);
          if (matches.length > 0) {
            const lines = matches.map(m => m.line);
            const minLine = Math.min(...lines);
            const maxLine = Math.max(...lines);
            discoveredFiles.set(file.file, {
              lines: { start: Math.max(1, minLine - 5), end: maxLine + 20 },
              reason: `Matched query: "${params.query}"`
            });
          }

          for (const match of matches) {
            const text = match.text.length > 120
              ? match.text.substring(0, 120) + '...'
              : match.text;
            output += `L${match.line}: ${text}\n`;
          }
        }
        if (data.results.length > maxFilesToShow) {
          output += `\n... and ${data.results.length - maxFilesToShow} more files`;
        }
        return output;
      }
      return 'No matches found.';
    }
    return `Error: ${result.error || 'Search failed'}`;
  }
}

/**
 * Glob search tool executor
 */
export class GlobSearchExecutor implements ToolExecutorStrategy {
  private tool = new GlobSearchTool();

  async execute(
    params: Record<string, string>,
    stats: SearchStats,
    discoveredFiles: Map<string, DiscoveredFileInfo>
  ): Promise<string> {
    stats.globCalls++;

    const maxResults = 30;

    const result = await this.tool.execute({
      pattern: params.pattern,
      path: params.path || '',
      maxResults,
      skipIndexing: true,
    });

    if (result.success && result.data) {
      const data = result.data as {
        totalFiles?: number;
        results?: Array<{ path: string; name: string }>;
      };

      stats.filesScanned += data.totalFiles || 0;

      if (data.results && data.results.length > 0) {
        let output = `Found ${data.totalFiles} files:\n`;
        for (const file of data.results.slice(0, 20)) {
          output += `- ${file.path}\n`;
          if (!discoveredFiles.has(file.path)) {
            discoveredFiles.set(file.path, {
              lines: { start: 1, end: 50 },
              reason: `Matched pattern: "${params.pattern}"`
            });
          }
        }
        if (data.results.length > 20) {
          output += `... and ${data.results.length - 20} more files`;
        }
        return output;
      }
      return 'No files found matching pattern.';
    }
    return `Error: ${result.error || 'Search failed'}`;
  }
}

/**
 * Read file snippet tool executor
 */
export class ReadFileSnippetExecutor implements ToolExecutorStrategy {
  private tool = new ReadFileTool();

  async execute(
    params: Record<string, string>,
    stats: SearchStats,
    _discoveredFiles: Map<string, DiscoveredFileInfo>
  ): Promise<string> {
    stats.readFileCalls++;
    const rawPath = (params.path || '').trim();

    // Guard against obviously invalid paths like numeric-only values (e.g. "1").
    // This prevents the sub-agent from wasting an iteration on nonsense paths.
    if (!rawPath || /^[0-9]+$/.test(rawPath)) {
      return 'Error: Invalid file path for read_file_snippet. Use a concrete relative file path like "src/file.ts", never just "1".';
    }

    const startLine = parseInt(params.startLine || '1', 10);
    const endLine = parseInt(params.endLine || '50', 10);

    const maxLines = 100;
    const limitedEnd = Math.min(endLine, startLine + maxLines - 1);
    const lineCount = limitedEnd - startLine + 1;

    const result = await this.tool.execute({
      path: rawPath,
      offset: startLine,
      limit: lineCount,
    });

    if (result.success && result.data) {
      const data = result.data as {
        path?: string;
        content?: string;
        startLine?: number;
        endLine?: number;
        totalLines?: number;
      };

      if (data.content) {
        let output = `File: ${data.path} (lines ${data.startLine}-${data.endLine} of ${data.totalLines})\n`;
        output += '```\n';
        output += data.content;
        output += '\n```';
        return output;
      }
      return 'File is empty.';
    }
    return `Error: ${result.error || 'Failed to read file'}`;
  }
}

/**
 * List directory tool executor
 */
export class ListDirExecutor implements ToolExecutorStrategy {
  private tool = new ListFilesTool();

  async execute(
    params: Record<string, string>,
    stats: SearchStats,
    _discoveredFiles: Map<string, DiscoveredFileInfo>
  ): Promise<string> {
    stats.listDirCalls++;

    const result = await this.tool.execute({
      path: params.path || '',
      recursive: false,
    });

    if (result.success && result.data) {
      const data = result.data as {
        path?: string;
        directories?: Array<{ name: string }>;
        files?: Array<{ name: string; size?: number }>;
        totalCount?: number;
      };

      let output = `Directory: ${data.path || '/'}\n`;

      if (data.directories && data.directories.length > 0) {
        output += '\nDirectories:\n';
        for (const dir of data.directories.slice(0, 20)) {
          output += `  📁 ${dir.name}/\n`;
        }
      }

      if (data.files && data.files.length > 0) {
        output += '\nFiles:\n';
        for (const file of data.files.slice(0, 30)) {
          output += `  📄 ${file.name}\n`;
        }
        if (data.files.length > 30) {
          output += `  ... and ${data.files.length - 30} more files\n`;
        }
      }

      if ((!data.directories || data.directories.length === 0) &&
          (!data.files || data.files.length === 0)) {
        output += 'Directory is empty.';
      }

      return output;
    }
    return `Error: ${result.error || 'Failed to list directory'}`;
  }
}

/**
 * Factory for creating tool executors
 */
export class ToolExecutorFactory {
  private static executors = new Map<string, ToolExecutorStrategy>([
    ['grep_search', new GrepSearchExecutor()],
    ['glob_search', new GlobSearchExecutor()],
    ['read_file_snippet', new ReadFileSnippetExecutor()],
    ['list_dir', new ListDirExecutor()],
  ]);

  static getExecutor(toolName: string): ToolExecutorStrategy | undefined {
    return this.executors.get(toolName);
  }
}