// Provider contract, deliberately minimal — mirrors lib/ai/types/ai-types.ts
// and lib/integrations/core/provider.ts: one small interface, a mock
// implementation used automatically until real credentials exist, and a
// registry that swaps providers by env var alone. Nothing above this layer
// (message-service.ts, the automation handler) knows or cares which
// provider is behind it.
export type MessageChannel = "whatsapp" | "sms";

export interface SendMessageParams {
  to: string;
  channel: MessageChannel;
  body: string;
}

export interface SendMessageResult {
  success: boolean;
  providerMessageId: string | null;
  error: string | null;
}

export interface MessagingProvider {
  readonly name: string;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}
