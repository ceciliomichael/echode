export interface SubAgentDefinition {
  id: string;
  name: string;
  persona: string;
  workflow?: string;
  allowedTools: string[]; // List of tool names allowed for this agent
  createdAt: Date;
}

export interface SubAgentSession {
  id: string;
  subAgentId: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  startTime: Date;
  endTime?: Date;
  // Promise control for use_subagent to await completion
  resolve?: (value: any) => void;
  reject?: (reason: any) => void;
}