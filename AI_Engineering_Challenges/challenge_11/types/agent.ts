export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  /** Wall-clock duration of the tool execution */
  durationMs?: number;
}

export interface AgentState {
  messages: ChatMessage[];
  toolCalls: ToolCall[];
  isStreaming: boolean;
  error: string | null;
}
