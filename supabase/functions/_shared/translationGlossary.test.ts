import { describe, expect, it } from 'vitest';

import {
  areGlossaryTermsSatisfied,
  buildGlossaryPrompt,
  buildSentenceExamplesPrompt,
  findExactGlossaryTranslation,
  findExactSentenceExampleTranslation,
  findGlossaryMatches,
  findRelevantSentenceExamples,
  type GlossaryEntry,
  type SentenceExampleEntry,
  normalizeTranslationText,
  selectEnforceableGlossaryMatches,
  translateWordByWordWithGlossary,
} from './translationGlossary';

describe('translationGlossary', () => {
  it('normalizes whitespace and quotes', () => {
    expect(normalizeTranslationText('  hi   there  ')).toBe('hi there');
    expect(normalizeTranslationText('“hello”')).toBe('"hello"');
  });

  it('returns exact glossary translation for known term', () => {
    expect(findExactGlossaryTranslation('bobolian', 'semai', 'en')).toBe('traditional healer');
    expect(findExactGlossaryTranslation('BoboHiz', 'semai', 'en')).toBe('rice wine');
  });

  it('finds glossary terms in sentence', () => {
    const matches = findGlossaryMatches('Saya jumpa bobolian di hutan', 'semai');
    const ids = matches.map((entry) => entry.id);

    expect(ids).toContain('bobolian');
    expect(ids).toContain('hutan');
  });

  it('builds glossary prompt hints', () => {
    const matches = findGlossaryMatches('bobolian', 'semai');
    const prompt = buildGlossaryPrompt(matches, 'semai', 'en');

    expect(prompt).toContain('"bobolian" => "traditional healer"');
  });

  it('limits glossary prompt hints to prevent oversized prompts', () => {
    const matches: GlossaryEntry[] = Array.from({ length: 14 }, (_, index) => ({
      id: `entry-${index}`,
      semai: `semai-${index}`,
      ms: `ms-${index}`,
      en: `en-${index}`,
      category: 'test',
      source: 'TUYANG translation MVP',
    }));

    const prompt = buildGlossaryPrompt(matches, 'semai', 'en');

    expect(prompt.match(/=>/g)?.length).toBe(8);
    expect(prompt).toContain('"semai-0" => "en-0"');
    expect(prompt).not.toContain('"semai-8" => "en-8"');
    expect(prompt).not.toContain('"semai-9" => "en-9"');
  });

  it('checks whether expected glossary terms exist in output', () => {
    const matches = findGlossaryMatches('bobolian di hutan', 'semai');

    expect(
      areGlossaryTermsSatisfied('traditional healer in the forest', matches, 'semai', 'en'),
    ).toBe(true);
    expect(areGlossaryTermsSatisfied('dream in the forest', matches, 'semai', 'en')).toBe(false);
  });

  it('does not allow substring false positives for glossary terms', () => {
    const matches = findGlossaryMatches('api', 'semai');

    expect(areGlossaryTermsSatisfied('fire', matches, 'semai', 'en')).toBe(true);
    expect(areGlossaryTermsSatisfied('firefly', matches, 'semai', 'en')).toBe(false);
  });

  it('treats ambiguous source terms as satisfied when any valid target sense appears', () => {
    const ambiguousGlossary: GlossaryEntry[] = [
      {
        id: 'ajak-invite',
        semai: 'ajak',
        ms: 'mengajak',
        en: 'invite',
        category: 'verb',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
    ];
    const matches = findGlossaryMatches('ajak', 'semai', ambiguousGlossary);

    expect(areGlossaryTermsSatisfied('invite', matches, 'semai', 'en')).toBe(true);
    expect(areGlossaryTermsSatisfied('grandmother', matches, 'semai', 'en')).toBe(true);
    expect(areGlossaryTermsSatisfied('sleep', matches, 'semai', 'en')).toBe(false);
  });

  it('skips ambiguous term hints when building strict glossary prompts', () => {
    const matches: GlossaryEntry[] = [
      {
        id: 'ajak-invite',
        semai: 'ajak',
        ms: 'mengajak',
        en: 'invite',
        category: 'verb',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'hutan',
        semai: 'hutan',
        ms: 'hutan',
        en: 'forest',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
    ];

    const prompt = buildGlossaryPrompt(matches, 'semai', 'en');
    expect(prompt).toContain('"hutan" => "forest"');
    expect(prompt).not.toContain('"ajak" =>');
  });

  it('selects enforceable glossary matches and drops ambiguous terms', () => {
    const matches: GlossaryEntry[] = [
      {
        id: 'ajak-invite',
        semai: 'ajak',
        ms: 'mengajak',
        en: 'invite',
        category: 'verb',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'traditional-healer',
        semai: 'dukun tradisional',
        ms: 'dukun tradisional',
        en: 'traditional healer',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'hutan',
        semai: 'hutan',
        ms: 'hutan',
        en: 'forest',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
    ];

    const selected = selectEnforceableGlossaryMatches(matches, 'semai', 'en');
    const ids = selected.map((entry) => entry.id);

    expect(ids).toContain('traditional-healer');
    expect(ids).toContain('hutan');
    expect(ids).not.toContain('ajak-invite');
    expect(ids).not.toContain('ajak-grandmother');
  });

  it('falls back to word-level glossary translation', () => {
    const testGlossary: GlossaryEntry[] = [
      {
        id: 'hutan-test',
        semai: 'hutan',
        ms: 'hutan',
        en: 'forest',
        category: 'nature',
        source: 'TUYANG translation MVP',
      },
    ];

    const output = translateWordByWordWithGlossary('Saya suka hutan', 'ms', 'en', testGlossary);
    expect(output).toBe('Saya suka forest');
  });

  it('returns null for ambiguous exact glossary translations', () => {
    const ambiguousGlossary: GlossaryEntry[] = [
      {
        id: 'ajak-invite',
        semai: 'ajak',
        ms: 'mengajak',
        en: 'invite',
        category: 'verb',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
    ];

    expect(findExactGlossaryTranslation('ajak', 'semai', 'en', ambiguousGlossary)).toBeNull();
  });

  it('keeps ambiguous words unchanged in word-by-word fallback', () => {
    const ambiguousGlossary: GlossaryEntry[] = [
      {
        id: 'ajak-invite',
        semai: 'ajak',
        ms: 'mengajak',
        en: 'invite',
        category: 'verb',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'TUYANG translation MVP',
      },
    ];

    expect(translateWordByWordWithGlossary('ajak', 'semai', 'en', ambiguousGlossary)).toBe('ajak');
  });

  it('returns exact sentence-example translation when source sentence matches', () => {
    const sentenceExamples: SentenceExampleEntry[] = [
      {
        id: 'kaciu-example',
        semai: 'Amek eng kitingroc ru kikep memerip ikor kak kaciu.',
        ms: 'Ibu saya memancing dan mendapat berberapa ekor ikan dari jenis ikan haruan.',
        en: 'My mother went fishing and caught several snakehead murrel fish.',
        headword: 'kaciu',
        source: 'Webonary Cloud API sentence example',
      },
    ];

    const output = findExactSentenceExampleTranslation(
      'Amek eng kitingroc ru kikep memerip ikor kak kaciu.',
      'semai',
      'en',
      sentenceExamples,
    );

    expect(output).toBe('My mother went fishing and caught several snakehead murrel fish.');

    const withoutPunctuation = findExactSentenceExampleTranslation(
      'Amek eng kitingroc ru kikep memerip ikor kak kaciu',
      'semai',
      'en',
      sentenceExamples,
    );

    expect(withoutPunctuation).toBe(
      'My mother went fishing and caught several snakehead murrel fish.',
    );
  });

  it('returns null for ambiguous exact sentence-example translation targets', () => {
    const sentenceExamples: SentenceExampleEntry[] = [
      {
        id: 'x-1',
        semai: 'A',
        ms: 'B',
        en: 'C',
        headword: 'x',
        source: 'TUYANG translation MVP',
      },
      {
        id: 'x-2',
        semai: 'A',
        ms: 'B',
        en: 'D',
        headword: 'x',
        source: 'TUYANG translation MVP',
      },
    ];

    expect(findExactSentenceExampleTranslation('A', 'semai', 'en', sentenceExamples)).toBeNull();
  });

  it('finds relevant sentence examples by token overlap and builds prompt', () => {
    const sentenceExamples: SentenceExampleEntry[] = [
      {
        id: 'kajeg-example',
        semai: 'Pelek sempak Bah Meran ajeh ihad kajeg, tapi irasa ihad isendap.',
        ms: 'Buah durian kepunyaan Bah Meran itu sangat kecil, tetapi rasanya sangat sedap.',
        en: 'The durian fruit belonging to Bah Meran is very small, but it tastes very good.',
        headword: 'kajeg',
        source: 'Webonary Cloud API sentence example',
      },
      {
        id: 'other',
        semai: 'Eng naja ku jerek.',
        ms: 'Saya pergi ke sungai.',
        en: 'I went to the river.',
        headword: 'jerek',
        source: 'Webonary Cloud API sentence example',
      },
    ];

    const matches = findRelevantSentenceExamples(
      'Pelek sempak Bah Meran ajeh ihad kajeg.',
      'semai',
      'en',
      sentenceExamples,
    );

    expect(matches[0]?.id).toBe('kajeg-example');

    const prompt = buildSentenceExamplesPrompt(matches, 'semai', 'en');
    expect(prompt).toContain('Use these real Webonary sentence examples as guidance');
    expect(prompt).toContain('Pelek sempak Bah Meran ajeh ihad kajeg, tapi irasa ihad isendap.');
    expect(prompt).toContain('The durian fruit belonging to Bah Meran is very small');
  });
});
