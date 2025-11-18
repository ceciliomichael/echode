import { ITool } from './tool.interface';

export class ToolRegistry {
  private tools = new Map<string, ITool>();

  constructor() {}

  registerTool(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getTools(): ITool[] {
    return Array.from(this.tools.values());
  }
}

export const defaultRegistry = new ToolRegistry();
