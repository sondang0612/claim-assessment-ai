import { createOpenAI } from '@ai-sdk/openai';

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/** Supported DeepSeek model identifiers. */
export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

export const DEFAULT_MODEL: DeepSeekModel = 'deepseek-chat';

/**
 * Creates a DeepSeek provider instance backed by the OpenAI-compatible SDK.
 * Pass a custom apiKey to override the DEEPSEEK_API_KEY environment variable
 * (useful for testing or multi-tenant scenarios).
 */
export function createDeepSeekProvider(apiKey?: string) {
  return createOpenAI({
    name: 'deepseek',
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: apiKey ?? process.env.DEEPSEEK_API_KEY ?? '',
  });
}

/**
 * Returns a LanguageModelV3 for the given DeepSeek model.
 * Uses the chat-completions endpoint (.chat()) which maps to /v1/chat/completions —
 * the endpoint DeepSeek exposes rather than the OpenAI responses API.
 *
 * deepseek-chat    — general-purpose, supports tool calling
 * deepseek-reasoner — chain-of-thought reasoning, supports tool calling
 */
export function getDeepSeekModel(model: DeepSeekModel = DEFAULT_MODEL) {
  return createDeepSeekProvider().chat(model);
}
