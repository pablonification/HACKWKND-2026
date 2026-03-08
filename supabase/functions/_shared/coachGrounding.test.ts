import { describe, expect, it } from 'vitest';

import {
  buildLearningSeed,
  collectRecentAssistantSemaiTexts,
  isExactVerifiedSemaiInput,
  resolveCoachTranslateDirection,
} from './coachGrounding.ts';

describe('coachGrounding', () => {
  it('uses prior meaningful user context for continue actions', () => {
    expect(
      buildLearningSeed({
        message: 'Continue.',
        extractedText: 'Continue.',
        clientAction: 'continue_session',
        track: 'vocabulary_first',
        turns: [
          { role: 'user', text: 'hello' },
          { role: 'assistant', text: 'Hi there.' },
          { role: 'user', text: 'I want to learn nature vocabulary' },
        ],
      }),
    ).toBe('I want to learn nature vocabulary');
  });

  it('detects exact verified Semai input from the dictionary', () => {
    expect(isExactVerifiedSemaiInput('cak')).toBe(true);
  });

  it('routes exact Semai inputs to Semai-to-user-language translation', () => {
    expect(resolveCoachTranslateDirection({ message: 'cak', answerLanguage: 'en' })).toEqual({
      text: 'cak',
      from: 'semai',
      to: 'en',
    });
  });

  it('collects recent assistant Semai texts so repeated entries can be skipped', () => {
    expect(
      collectRecentAssistantSemaiTexts([
        { role: 'assistant', text: 'bobohiz' },
        { role: 'assistant', text: 'cak' },
      ]),
    ).toEqual(new Set(['bobohiz', 'cak']));
  });
});
