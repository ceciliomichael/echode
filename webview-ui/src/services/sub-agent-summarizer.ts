import { chatApi } from './chat-api';
import type { Message } from '../types/chat';
import type { ChatMode } from '../types/chat-mode';


const SUMMARIZATION_PROMPT = `
You are a Sub-Agent Summarizer. Your task is to analyze the conversation history of a sub-agent session and generate a concise but comprehensive summary of the work done.

## INPUT
- A conversation history between a User (Main Agent) and a Sub-Agent.
- The initial task assigned to the Sub-Agent.

## OUTPUT
- A structured summary in JSON format.

## FORMAT
{
  "status": "completed" | "failed" | "partial",
  "summary": "High-level summary of what was achieved (1-2 sentences)",
  "details": [
    "Bullet point 1 of key actions taken",
    "Bullet point 2...",
    ...
  ],
  "files_modified": [
    "path/to/file1.ts",
    "path/to/file2.ts"
  ],
  "findings": "Any important discoveries or issues found (optional)"
}

## RULES
1. Focus on RESULTS: What files were changed? What logic was implemented?
2. Be CONCISE: The Main Agent needs to know what happened quickly.
3. If the task failed or wasn't completed, clearly state why in the status and summary.
4. Ignore minor conversational filler. Focus on tool executions and their results.
5. Do NOT output markdown code blocks. Output RAW JSON only.
`;

export async function summarizeSubAgentSession(
  messages: Message[],
  initialTask: string
): Promise<string> {
  // Filter out system prompts and hidden messages to save tokens
  const conversationHistory = messages
    .filter(m => !m.hidden && m.role !== 'system')
    .map(m => `${m.role.toUpperCase()}: ${typeof m.content === 'string' ? m.content : '[Complex Content]'}`)
    .join('\n\n');

  const userPrompt = `
INITIAL TASK: ${initialTask}

CONVERSATION HISTORY:
${conversationHistory}

Generate the summary JSON now.
`;

  // Use the 'agent' mode model for summarization as it's likely the most capable
  const mode: ChatMode = 'agent';

  // Construct messages for the LLM
  const llmMessages = [
    { role: 'system', content: SUMMARIZATION_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  let summary = '';

  try {
    // We use the streamChat API but just collect the result
    // Note: We don't use tools here, just pure text generation
    const stream = chatApi.streamChat(llmMessages, undefined, mode);
    
    for await (const chunk of stream) {
      summary += chunk;
    }

    // Try to parse JSON to ensure validity, otherwise wrap raw text
    try {
        // Remove markdown code blocks if present
        const cleanSummary = summary.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        JSON.parse(cleanSummary); // Check validity
        return cleanSummary;
    } catch (e) {
        // If not valid JSON, wrap it
        return JSON.stringify({
            status: "completed",
            summary: "Session completed (Raw summary generated)",
            details: [summary],
            files_modified: [],
            findings: "Warning: LLM did not return valid JSON summary"
        });
    }

  } catch (error) {
    console.error('Failed to summarize sub-agent session:', error);
    return JSON.stringify({
        status: "failed",
        summary: "Failed to generate summary due to error",
        details: [String(error)],
        files_modified: []
    });
  }
}