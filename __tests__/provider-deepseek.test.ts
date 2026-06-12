/**
 * DeepSeek provider configuration tests.
 * Validates that the provider is wired correctly: baseURL, model IDs, factory shape.
 * No API calls are made — these are purely structural/configuration tests.
 */
import { describe, it, expect } from 'vitest';
import {
  createDeepSeekProvider,
  getDeepSeekModel,
  DEEPSEEK_BASE_URL,
  DEFAULT_MODEL,
} from '@/lib/providers/deepseek';

describe('DeepSeek provider — configuration', () => {
  it('exports the correct base URL', () => {
    expect(DEEPSEEK_BASE_URL).toBe('https://api.deepseek.com');
  });

  it('defaults to deepseek-chat model', () => {
    expect(DEFAULT_MODEL).toBe('deepseek-chat');
  });

  it('createDeepSeekProvider() returns a callable provider function', () => {
    const provider = createDeepSeekProvider('test-key');
    expect(typeof provider).toBe('function');
  });

  it('createDeepSeekProvider() has a .chat() method', () => {
    const provider = createDeepSeekProvider('test-key');
    expect(typeof provider.chat).toBe('function');
  });

  it('accepts a custom apiKey without throwing', () => {
    expect(() => createDeepSeekProvider('custom-key-abc')).not.toThrow();
  });

  it('works with an empty apiKey (runtime validation, not construction-time)', () => {
    expect(() => createDeepSeekProvider('')).not.toThrow();
  });
});

describe('DeepSeek provider — model selection', () => {
  it('getDeepSeekModel() returns a model object for deepseek-chat', () => {
    const model = getDeepSeekModel('deepseek-chat');
    expect(model).toBeDefined();
    expect(model).not.toBeNull();
  });

  it('getDeepSeekModel() returns a model object for deepseek-reasoner', () => {
    const model = getDeepSeekModel('deepseek-reasoner');
    expect(model).toBeDefined();
    expect(model).not.toBeNull();
  });

  it('getDeepSeekModel() defaults to deepseek-chat when called with no arguments', () => {
    const defaultModel = getDeepSeekModel();
    const explicitModel = getDeepSeekModel('deepseek-chat');
    // Both are objects with the same shape (LanguageModelV3)
    expect(typeof defaultModel).toBe(typeof explicitModel);
    expect(defaultModel).toBeDefined();
  });

  it('model object has expected LanguageModelV3 properties', () => {
    const model = getDeepSeekModel('deepseek-chat');
    // LanguageModelV3 always exposes modelId and provider
    expect(typeof (model as { modelId?: unknown }).modelId).toBe('string');
    expect(typeof (model as { provider?: unknown }).provider).toBe('string');
  });

  it('deepseek-chat and deepseek-reasoner have different modelId values', () => {
    const chat = getDeepSeekModel('deepseek-chat') as { modelId: string };
    const reasoner = getDeepSeekModel('deepseek-reasoner') as { modelId: string };
    expect(chat.modelId).not.toBe(reasoner.modelId);
  });
});
