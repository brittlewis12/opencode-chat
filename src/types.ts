// Shared types for OpenCode integration

export interface Message {
  info?: {
    id: string;
    role: "user" | "assistant" | "system";
    sessionID: string;
    modelID?: string;
    providerID?: string;
    cost?: number;
    tokens?: {
      input: number;
      output: number;
      reasoning?: number;
    };
    time?: {
      created: number;
      completed?: number;
    };
  };
  parts: MessagePart[];
}

export interface MessagePart {
  id: string;
  messageID: string;
  sessionID: string;
  type: "text" | "tool" | "step-start" | "step-finish";
  text?: string;
  tool?: string;
  callID?: string;
  state?: {
    status: "pending" | "running" | "completed" | "error";
    input?: any;
    output?: string;
    error?: string;
    metadata?: any;
    time?: {
      start?: number;
      end?: number;
    };
  };
  title?: string;
  tokens?: any;
  cost?: number;
}

export interface Permission {
  id: string;
  type: string;
  pattern?: string;
  sessionID: string;
  messageID?: string;
  callID?: string;
  title: string;
  metadata: Record<string, any>;
  time?: {
    created: number;
  };
}
