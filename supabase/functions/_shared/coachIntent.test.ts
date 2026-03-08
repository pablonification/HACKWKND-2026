import { describe, expect, it } from 'vitest';

import { classifyCoachIntent, detectCoachAnswerLanguage } from './coachIntent.ts';

describe('coachIntent', () => {
  it('detects scenario start learning requests', () => {
    expect(classifyCoachIntent('Teach me a short daily Semai conversation')).toMatchObject({
      mode: 'learning',
      turnType: 'scenario_start',
      responseMode: 'scenario',
      targetLanguage: 'semai',
    });
  });

  it('routes learning-journey onboarding prompts to scenario mode, not translation', () => {
    expect(classifyCoachIntent('I want to learn Semai, can you help me doing that?')).toMatchObject(
      {
        mode: 'learning',
        turnType: 'scenario_start',
        responseMode: 'scenario',
      },
    );
  });

  it('detects translation-oriented learning requests', () => {
    expect(classifyCoachIntent('How do I say thank you?')).toMatchObject({
      mode: 'learning',
      turnType: 'how_to_say',
      responseMode: 'translation',
      targetLanguage: 'semai',
      extractedText: 'thank you',
    });
  });

  it('detects word help requests and keeps Semai as the source language', () => {
    expect(classifyCoachIntent('What does engku mean?')).toMatchObject({
      mode: 'learning',
      turnType: 'word_help',
      sourceLanguage: 'semai',
      extractedText: 'engku',
    });
  });

  it('routes troubleshooting questions to direct help', () => {
    expect(classifyCoachIntent('Why is this feature broken?')).toMatchObject({
      mode: 'direct_help',
      responseMode: 'direct_answer',
    });
  });

  it('keeps generic language-concept prompts in direct help mode', () => {
    expect(classifyCoachIntent('Explain language revitalization in simple terms.')).toMatchObject({
      mode: 'direct_help',
      responseMode: 'direct_answer',
    });
  });

  it('uses scenario onboarding for generic Semai mentions instead of sentence translation', () => {
    expect(classifyCoachIntent('I am interested in Semai language.')).toMatchObject({
      mode: 'learning',
      turnType: 'scenario_start',
      responseMode: 'scenario',
    });
  });

  it('treats sentence-request prompts as coached sentence help, not prompt translation', () => {
    expect(classifyCoachIntent('Give me one simple sentence in Semai.')).toMatchObject({
      mode: 'learning',
      turnType: 'sentence_help',
      responseMode: 'sentence_help',
      extractedText: undefined,
    });
  });

  it('asks for clarification on ambiguous short prompts', () => {
    expect(classifyCoachIntent('help')).toMatchObject({
      mode: 'clarification',
      needsClarification: true,
    });
  });

  it('detects Malay answer language for Malay prompts', () => {
    expect(detectCoachAnswerLanguage('Boleh ajar saya bahasa Semai hari ini?')).toBe('ms');
  });
});
