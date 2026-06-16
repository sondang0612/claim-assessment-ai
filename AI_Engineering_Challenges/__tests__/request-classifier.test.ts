/**
 * Unit tests for the request classifier.
 * Verifies deterministic regex-based classification for all four message categories.
 */
import { describe, it, expect } from 'vitest';
import { classifyRequest } from '@/lib/classifier/requestClassifier';

// ── claim_request ─────────────────────────────────────────────────────────────

describe('classifyRequest — claim_request', () => {
  it('classifies message with CLM- identifier', () => {
    expect(classifyRequest('Please assess claim CLM-001').messageClass).toBe('claim_request');
  });

  it('classifies message with POL- identifier', () => {
    expect(classifyRequest('Look up policy POL-001 for John Doe').messageClass).toBe('claim_request');
  });

  it('classifies message with DOC- identifier', () => {
    expect(classifyRequest('Documents: DOC-001, DOC-002').messageClass).toBe('claim_request');
  });

  it('classifies surgery + CPT code as claim_request', () => {
    expect(classifyRequest('surgery procedure CPT 44970 amount $5000').messageClass).toBe('claim_request');
  });

  it('classifies claim keyword + dollar amount as claim_request', () => {
    expect(classifyRequest('Submit a claim for $5000').messageClass).toBe('claim_request');
  });

  it('classifies diagnosis + ICD code as claim_request', () => {
    expect(classifyRequest('diagnosis K37 appendicitis $5000').messageClass).toBe('claim_request');
  });

  it('claim ID takes priority over greeting prefix', () => {
    expect(classifyRequest('Hello, please assess CLM-001').messageClass).toBe('claim_request');
  });

  it('claim ID takes priority over help prefix', () => {
    expect(classifyRequest('help me with claim CLM-001 please').messageClass).toBe('claim_request');
  });

  it('classifies full claim message', () => {
    const msg =
      'Claim CLM-001, patient John Doe, policy POL-001, docs DOC-001 DOC-002, ' +
      'diagnosis appendicitis, procedure 44970, surgery, requested $5000';
    expect(classifyRequest(msg).messageClass).toBe('claim_request');
  });

  it('classifies hospitalization + amount as claim_request', () => {
    expect(classifyRequest('hospitalization claim $12,000').messageClass).toBe('claim_request');
  });
});

// ── greeting ─────────────────────────────────────────────────────────────────

describe('classifyRequest — greeting', () => {
  it('hi', () => expect(classifyRequest('hi').messageClass).toBe('greeting'));
  it('hello', () => expect(classifyRequest('hello').messageClass).toBe('greeting'));
  it('hey', () => expect(classifyRequest('hey').messageClass).toBe('greeting'));
  it('Hello!', () => expect(classifyRequest('Hello!').messageClass).toBe('greeting'));
  it('hola', () => expect(classifyRequest('hola').messageClass).toBe('greeting'));
  it('xin chào', () => expect(classifyRequest('xin chào').messageClass).toBe('greeting'));
  it('xin chao', () => expect(classifyRequest('xin chao').messageClass).toBe('greeting'));
  it('how are you?', () => expect(classifyRequest('how are you?').messageClass).toBe('greeting'));
  it('How are you doing?', () =>
    expect(classifyRequest('How are you doing?').messageClass).toBe('greeting'));
  it('good morning', () => expect(classifyRequest('good morning').messageClass).toBe('greeting'));
  it('good afternoon', () =>
    expect(classifyRequest('Good afternoon!').messageClass).toBe('greeting'));
  it('greetings', () => expect(classifyRequest('greetings').messageClass).toBe('greeting'));
  it('hi there', () => expect(classifyRequest('hi there').messageClass).toBe('greeting'));
  it("what's up", () => expect(classifyRequest("what's up").messageClass).toBe('greeting'));
});

// ── help_request ──────────────────────────────────────────────────────────────

describe('classifyRequest — help_request', () => {
  it('help', () => expect(classifyRequest('help').messageClass).toBe('help_request'));
  it('how does this work?', () =>
    expect(classifyRequest('how does this work?').messageClass).toBe('help_request'));
  it('what can you do?', () =>
    expect(classifyRequest('what can you do?').messageClass).toBe('help_request'));
  it('how do I get started?', () =>
    expect(classifyRequest('how do I get started?').messageClass).toBe('help_request'));
  it('what information do I need to provide?', () =>
    expect(classifyRequest('what information do I need to provide?').messageClass).toBe(
      'help_request',
    ));
  it('instructions', () =>
    expect(classifyRequest('instructions please').messageClass).toBe('help_request'));
  it('what should I submit', () =>
    expect(classifyRequest('what should I submit').messageClass).toBe('help_request'));
  it('what do I need to provide', () =>
    expect(classifyRequest('what do I need to provide').messageClass).toBe('help_request'));
});

// ── unsupported ───────────────────────────────────────────────────────────────

describe('classifyRequest — unsupported', () => {
  it('random question', () =>
    expect(classifyRequest("what's the weather today?").messageClass).toBe('unsupported'));
  it('empty string', () => expect(classifyRequest('').messageClass).toBe('unsupported'));
  it('unrelated request', () =>
    expect(classifyRequest('tell me a joke').messageClass).toBe('unsupported'));
  it('vague claim mention without identifiers or amounts', () =>
    expect(classifyRequest('I need to file a claim').messageClass).toBe('unsupported'));
  it('patient name only', () =>
    expect(classifyRequest('John Doe').messageClass).toBe('unsupported'));
});
