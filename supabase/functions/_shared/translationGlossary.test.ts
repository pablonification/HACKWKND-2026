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
    expect(findExactGlossaryTranslation('darat', 'semai', 'en')).toBe('forest');
    expect(findExactGlossaryTranslation('Abat', 'semai', 'en')).toBe('cloth');
  });

  it('finds glossary terms in sentence', () => {
    const matches = findGlossaryMatches('Ku jeres jeoi binatag liar', 'semai');
    const ids = matches.map((entry) => entry.id);

    expect(ids).toContain('jeres-jungle');
  });

  it('builds glossary prompt hints', () => {
    const matches = findGlossaryMatches('jeres', 'semai');
    const prompt = buildGlossaryPrompt(matches, 'semai', 'en');

    expect(prompt).toContain('"jeres" => "jungle"');
  });

  it('passes all glossary entries through without internal truncation', () => {
    const matches: GlossaryEntry[] = Array.from({ length: 14 }, (_, index) => ({
      id: `entry-${index}`,
      semai: `semai-${index}`,
      ms: `ms-${index}`,
      en: `en-${index}`,
      category: 'test',
      source: 'Test fixture',
    }));

    const prompt = buildGlossaryPrompt(matches, 'semai', 'en');

    // buildGlossaryPrompt no longer truncates — caller caps via GLOSSARY_ENFORCEMENT_MAX_MATCHES
    expect(prompt.match(/=>/g)?.length).toBe(14);
    expect(prompt).toContain('"semai-0" => "en-0"');
    expect(prompt).toContain('"semai-13" => "en-13"');
  });

  it('checks whether expected glossary terms exist in output', () => {
    const matches = findGlossaryMatches('jeres', 'semai');

    expect(areGlossaryTermsSatisfied('jungle', matches, 'semai', 'en')).toBe(true);
    expect(areGlossaryTermsSatisfied('forest', matches, 'semai', 'en')).toBe(false);
  });

  it('does not allow substring false positives for glossary terms', () => {
    const matches = findGlossaryMatches('abat', 'semai');

    expect(areGlossaryTermsSatisfied('cloth', matches, 'semai', 'en')).toBe(true);
    expect(areGlossaryTermsSatisfied('clothesline', matches, 'semai', 'en')).toBe(false);
  });

  it('treats ambiguous source terms as satisfied when any valid target sense appears', () => {
    const ambiguousGlossary: GlossaryEntry[] = [
      {
        id: 'ajak-invite',
        semai: 'ajak',
        ms: 'mengajak',
        en: 'invite',
        category: 'verb',
        source: 'Test fixture',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'Test fixture',
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
        source: 'Test fixture',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'Test fixture',
      },
      {
        id: 'darat',
        semai: 'darat',
        ms: 'hutan',
        en: 'forest',
        category: 'noun',
        source: 'Webonary Cloud API',
      },
    ];

    const enforceable = selectEnforceableGlossaryMatches(matches, 'semai', 'en');
    const prompt = buildGlossaryPrompt(enforceable, 'semai', 'en');
    expect(prompt).toContain('"darat" => "forest"');
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
        source: 'Test fixture',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'Test fixture',
      },
      {
        id: 'abat-cloth',
        semai: 'abat',
        ms: 'kain',
        en: 'cloth',
        category: 'noun',
        source: 'Webonary Cloud API',
      },
      {
        id: 'darat',
        semai: 'darat',
        ms: 'hutan',
        en: 'forest',
        category: 'noun',
        source: 'Webonary Cloud API',
      },
    ];

    const selected = selectEnforceableGlossaryMatches(matches, 'semai', 'en');
    const ids = selected.map((entry) => entry.id);

    expect(ids).toContain('abat-cloth');
    expect(ids).toContain('darat');
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
        source: 'Test fixture',
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
        source: 'Test fixture',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'Test fixture',
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
        source: 'Test fixture',
      },
      {
        id: 'ajak-grandmother',
        semai: 'ajak',
        ms: 'nenek',
        en: 'grandmother',
        category: 'noun',
        source: 'Test fixture',
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
        source: 'Test fixture',
      },
      {
        id: 'x-2',
        semai: 'A',
        ms: 'B',
        en: 'D',
        headword: 'x',
        source: 'Test fixture',
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
