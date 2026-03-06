import { describe, expect, it } from 'vitest';

import { findSemaiDictionaryHints } from './semaiDictionary';

describe('semaiDictionary', () => {
  it('stops suggesting other sentence examples once an exact sentence match is found', async () => {
    const hints = await findSemaiDictionaryHints('"Adeh baju hek?" Wak Tania kitanya nu itenek.');

    expect(hints.some((hint) => hint.matchType === 'sentence_exact')).toBe(true);
    expect(hints.some((hint) => hint.matchType === 'sentence_fuzzy')).toBe(false);
  });

  it('returns closest Webonary sentence examples for near-miss transcripts', async () => {
    const hints = await findSemaiDictionaryHints('ade bejo hek wak tania kita nyeng itenek');
    const sentenceHint = hints.find((hint) => hint.matchType === 'sentence_fuzzy');

    expect(sentenceHint?.kind).toBe('sentence_example');
    expect(sentenceHint?.semai).toContain('Adeh baju hek?');
    expect(sentenceHint?.semai).toContain('Wak Tania');
  });

  it('filters out exact token matches so only actionable corrections remain', async () => {
    const hints = await findSemaiDictionaryHints('ade bejo hek wak tania kita nyeng itenek');

    expect(hints.some((hint) => hint.matchType === 'token_exact')).toBe(false);
    expect(
      hints.some((hint) => hint.matchedText === 'hek' && hint.semai.toLowerCase() === 'hek'),
    ).toBe(false);
  });

  it('returns fuzzy hints for near-miss Semai spellings', async () => {
    const hints = await findSemaiDictionaryHints('abekk');
    const fuzzyHint = hints.find(
      (hint) => hint.matchType === 'phrase_fuzzy' || hint.matchType === 'token_fuzzy',
    );

    expect(fuzzyHint?.semai.toLowerCase()).toBe('abek');
  });
});
