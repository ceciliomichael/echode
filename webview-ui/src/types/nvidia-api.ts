export interface ChatMessage {
  role: string;
  content: string;
}

export interface StreamChunkDelta {
  content?: string;
}

export interface StreamChunkChoice {
  delta: StreamChunkDelta;
  finish_reason: string | null;
}

export interface StreamChunk {
  choices: StreamChunkChoice[];
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
}