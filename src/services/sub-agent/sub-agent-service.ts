import { v4 as uuidv4 } from 'uuid';
import { SubAgentDefinition, SubAgentSession } from './types';

export class SubAgentService {
  private static instance: SubAgentService;
  private definitions = new Map<string, SubAgentDefinition>();
  // Index to look up definitions by name
  private nameToIdMap = new Map<string, string>();
  private sessions = new Map<string, SubAgentSession>();

  private constructor() {}

  public static getInstance(): SubAgentService {
    if (!SubAgentService.instance) {
      SubAgentService.instance = new SubAgentService();
    }
    return SubAgentService.instance;
  }

  /**
   * Register a new sub-agent definition
   */
  public createSubAgent(
    name: string,
    persona: string,
    workflow: string | undefined,
    allowedTools: string[]
  ): SubAgentDefinition {
    const id = uuidv4();
    // Ensure allowedTools is an array (no auto-added tools)
    const toolsList = Array.isArray(allowedTools) ? allowedTools : [];
    const finalAllowedTools = [...new Set(toolsList)];
    
    const definition: SubAgentDefinition = {
      id,
      name,
      persona,
      workflow,
      allowedTools: finalAllowedTools,
      createdAt: new Date()
    };

    this.definitions.set(id, definition);
    this.nameToIdMap.set(name, id);
    return definition;
  }

  public getDefinition(id: string): SubAgentDefinition | undefined {
    return this.definitions.get(id);
  }

  public getDefinitionByName(name: string): SubAgentDefinition | undefined {
    const id = this.nameToIdMap.get(name);
    return id ? this.definitions.get(id) : undefined;
  }

  /**
   * Start a new session for a sub-agent
   * Returns the session object and a promise that resolves when the agent reports back
   */
  public createSession(subAgentName: string, task: string): { session: SubAgentSession, resultPromise: Promise<any> } {
    const definition = this.getDefinitionByName(subAgentName);
    if (!definition) {
      throw new Error(`Sub-agent with name "${subAgentName}" not found`);
    }

    // Use a shorter, more readable ID for better UX in prompts
    const shortId = uuidv4().split('-')[0];
    const sessionId = `agent-${shortId}-${Date.now().toString().slice(-4)}`;
    
    let resolvePromise: (value: any) => void;
    let rejectPromise: (reason: any) => void;

    const resultPromise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const session: SubAgentSession = {
      id: sessionId,
      subAgentId: definition.id,
      task,
      status: 'pending',
      startTime: new Date(),
      resolve: resolvePromise!,
      reject: rejectPromise!
    };

    this.sessions.set(sessionId, session);

    return { session, resultPromise };
  }

  public getSession(sessionId: string): SubAgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Called to complete a session (e.g. by manual user action in the UI)
   * Returns true if session was found and resolved, false otherwise
   */
  public resolveSession(sessionId: string, result: any): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      // Might happen if session was already cleaned up or ID is wrong
      console.warn(`Attempted to resolve unknown session ${sessionId}`);
      return false;
    }

    if (session.status === 'completed' || session.status === 'failed') {
      return true; // Already handled, but valid session
    }

    session.status = 'completed';
    session.result = result;
    session.endTime = new Date();
    
    if (session.resolve) {
      session.resolve(result);
    }
    return true;
  }

  public failSession(sessionId: string, error: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.endTime = new Date();
    
    if (session.reject) {
      session.reject(error);
    }
  }

  /**
   * Get all currently active (pending or running) sessions
   * @param excludeSessionId Optional session ID to exclude from the result
   */
  public getActiveSessions(excludeSessionId?: string): SubAgentSession[] {
    return Array.from(this.sessions.values()).filter(session => 
      (session.status === 'pending' || session.status === 'running') && 
      session.id !== excludeSessionId
    );
  }
}

export const getSubAgentService = () => SubAgentService.getInstance();