import { describe, expect, it } from 'vitest';

import { extractTopicHint, inferScenarioTopic, topicLabelForLanguage } from './coachTopic.ts';

describe('coachTopic', () => {
  it('does not treat a greeting as the learning topic fallback', () => {
    expect(
      inferScenarioTopic('I want to learn Semai vocab', [
        { role: 'user', text: 'hello' },
        { role: 'assistant', text: 'How would you like to start?' },
      ]),
    ).toBe('vocabulary');
  });

  it('recognizes short vocab phrasing as vocabulary instead of ignoring it', () => {
    expect(extractTopicHint('Semai vocab')).toBe('vocabulary');
  });

  it('maps onboarding greeting track labels correctly', () => {
    expect(topicLabelForLanguage('greetings', 'en')).toBe('greetings');
    expect(topicLabelForLanguage('greetings', 'ms')).toBe('sapaan');
  });

  it('ignores raw greetings as topic hints', () => {
    expect(extractTopicHint('hello')).toBeNull();
    expect(extractTopicHint('good morning')).toBeNull();
  });
});
