import { MCPClient } from './mcp-client';
import { MCPTool } from './mcp-types';
import { ITool, ToolExecutionResult, ToolProgressCallback, ChatMode } from '../tools/tool.interface';

/**
 * Adapter to make MCP tools compatible with Echode's ITool interface
 */
export class MCPToolAdapter implements ITool {
  name: string;
  description: string;
  parameters: any;
  
  private client: MCPClient;
  private source: string;
  private originalName: string;

  constructor(mcpTool: MCPTool, client: MCPClient, source: string) {
    this.originalName = mcpTool.name;
    this.name = `mcp_${mcpTool.name}`;
    this.description = `[${source}] ${mcpTool.description || ''}`;
    this.parameters = mcpTool.inputSchema;
    this.client = client;
    this.source = source;
  }

  /**
   * Generate tool instruction string for the AI system prompt
   */
  getInstruction(): string {
    const params = this.parameters.properties || {};
    const required = new Set(this.parameters.required || []);
    
    let paramLines: string[] = [];
    
    for (const [key, schema] of Object.entries(params) as [string, any][]) {
      const type = schema.type || 'any';
      const desc = schema.description ? ` (${schema.description})` : '';
      const isRequired = required.has(key) ? ' (required)' : ' (optional)';
      paramLines.push(`- ${key}: ${type}${isRequired}${desc}`);
    }

    const paramsSection = paramLines.length > 0
      ? `\nParameters:\n${paramLines.join('\n')}`
      : '\nParameters: none';

    return `## ${this.name}
${this.description}${paramsSection}`;
  }

  async execute(
    params: Record<string, unknown>,
    _onProgress?: ToolProgressCallback,
    _signal?: AbortSignal,
    _mode?: ChatMode
  ): Promise<ToolExecutionResult> {
    try {
      const result = await this.client.callTool({
        name: this.originalName,
        arguments: params
      });

      if (result.isError) {
        return {
          success: false,
          error: result.content.map(c => c.type === 'text' ? c.text : '').join('\n'),
        };
      }

      // Format content for Echode
      let content = '';
      for (const item of result.content) {
        if (item.type === 'text') {
          content += item.text + '\n';
        } else if (item.type === 'image') {
          content += `[Image: ${item.mimeType}]\n`;
        } else if (item.type === 'resource') {
          content += `[Resource: ${item.resource.uri}]\n`;
        }
      }

      return {
        success: true,
        data: content.trim()
      };

    } catch (error) {
      return {
        success: false,
        error: `Error executing MCP tool ${this.name}: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}