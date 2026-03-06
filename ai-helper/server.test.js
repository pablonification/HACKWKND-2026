import { describe, expect, it } from 'vitest';

import {
  applyLexiconCorrections,
  buildAsrLanguageOrder,
  buildWordReplacementResult,
  buildRuntimeConfig,
  buildVerifiedRecordingTermsFromRows,
  chooseBestAsrCandidate,
  extractTranscriptionFromPayload,
  getTopSentenceMatch,
  mergeAsrCandidateTokens,
  normalizeLexiconText,
  normalizeStoragePath,
} from './server.js';

describe('ai-helper config', () => {
  it('uses defaults when env values are missing', () => {
    const config = buildRuntimeConfig({});

    expect(config.port).toBe(8787);
    expect(config.timeoutMs).toBe(120000);
    expect(config.omniLanguage).toBe('sea_Latn');
    expect(config.recordingsBucket).toBe('recordings');
    expect(config.allowAnyCorsOrigin).toBe(true);
  });

  it('parses environment overrides', () => {
    const config = buildRuntimeConfig({
      AI_HELPER_PORT: '9900',
      OMNIASR_TIMEOUT_MS: '45000',
      OMNIASR_LANGUAGE: 'eng_Latn',
      SUPABASE_RECORDINGS_BUCKET: 'custom-recordings',
      AI_HELPER_CORS_ORIGINS: 'http://localhost:5173,https://example.com',
    });

    expect(config.port).toBe(9900);
    expect(config.timeoutMs).toBe(45000);
    expect(config.omniLanguage).toBe('eng_Latn');
    expect(config.recordingsBucket).toBe('custom-recordings');
    expect(config.allowAnyCorsOrigin).toBe(false);
    expect(config.corsOrigins).toEqual(['http://localhost:5173', 'https://example.com']);
  });
});

describe('storage path normalization', () => {
  it('removes leading slashes and bucket prefix', () => {
    expect(normalizeStoragePath('/recordings/user-a/rec-1.webm')).toBe('user-a/rec-1.webm');
    expect(normalizeStoragePath('recordings/user-a/rec-2.webm')).toBe('user-a/rec-2.webm');
  });

  it('keeps relative paths intact', () => {
    expect(normalizeStoragePath('user-a/rec-3.webm')).toBe('user-a/rec-3.webm');
  });
});

describe('transcription extraction', () => {
  it('returns trimmed transcription string', () => {
    expect(extractTranscriptionFromPayload({ transcription: '  halo semai  ' })).toBe('halo semai');
  });

  it('returns empty string when payload does not contain transcription', () => {
    expect(extractTranscriptionFromPayload({})).toBe('');
    expect(extractTranscriptionFromPayload(null)).toBe('');
  });
});

describe('ensemble language order', () => {
  it('keeps requested language first and deduplicates defaults', () => {
    expect(buildAsrLanguageOrder('mly_Latn')).toEqual([
      'mly_Latn',
      'sea_Latn',
      'ind_Latn',
      'eng_Latn',
    ]);
  });

  it('uses default order when language is empty', () => {
    expect(buildAsrLanguageOrder('')).toEqual(['sea_Latn', 'mly_Latn', 'ind_Latn', 'eng_Latn']);
  });
});

describe('candidate selection', () => {
  const lexicon = {
    phrases: ['bobolian', 'cak', 'kadag', 'dajis'],
    multiTokenPhrases: [],
    tokens: ['bobolian', 'cak', 'kadag', 'dajis'],
    tokenSet: new Set(['bobolian', 'cak', 'kadag', 'dajis']),
  };

  it('prefers candidate with stronger lexicon coverage', () => {
    const selection = chooseBestAsrCandidate(
      [
        { language: 'sea_Latn', transcription: 'bobolian chakkadogdajis' },
        { language: 'mly_Latn', transcription: 'bobolian cak kadag dagis' },
        { language: 'eng_Latn', transcription: 'bobolian chakadagis' },
      ],
      lexicon,
      ['sea_Latn', 'mly_Latn', 'ind_Latn', 'eng_Latn'],
    );

    expect(selection?.best.language).toBe('mly_Latn');
  });

  it('boosts candidates that are closer to known dictionary sentence examples', () => {
    const sentenceLexicon = {
      phrases: ['adeh baju hek wak tania kitanya nu itenek'],
      multiTokenPhrases: [
        {
          phrase: 'adeh baju hek wak tania kitanya nu itenek',
          tokens: ['adeh', 'baju', 'hek', 'wak', 'tania', 'kitanya', 'nu', 'itenek'],
        },
      ],
      tokens: ['adeh', 'baju', 'hek', 'wak', 'tania', 'kitanya', 'nu', 'itenek'],
      tokenSet: new Set(['adeh', 'baju', 'hek', 'wak', 'tania', 'kitanya', 'nu', 'itenek']),
    };

    const selection = chooseBestAsrCandidate(
      [
        { language: 'mly_Latn', transcription: 'ade bejo hek wak tania kita nyeng itenek' },
        { language: 'sea_Latn', transcription: 'aduh bajo hak wak tanie kitanya no itenek' },
        { language: 'eng_Latn', transcription: 'what tania asks about clothes' },
      ],
      sentenceLexicon,
      ['sea_Latn', 'mly_Latn', 'ind_Latn', 'eng_Latn'],
    );

    const nearSentenceCandidate = selection?.scored.find(
      (candidate) => candidate.transcription === 'ade bejo hek wak tania kita nyeng itenek',
    );

    expect(nearSentenceCandidate?.scoreBreakdown.phraseSupport).toBeGreaterThan(0.45);
    expect(nearSentenceCandidate?.scoreBreakdown.phraseSupport).toBeGreaterThan(
      nearSentenceCandidate?.scoreBreakdown.consensus ?? 0,
    );
  });

  it('normalizes accents for lexicon comparison', () => {
    expect(normalizeLexiconText('àbɔr àbì')).toBe('abor abi');
  });

  it('applies conservative token correction from lexicon', () => {
    expect(applyLexiconCorrections('bobolian cak kadag dagis', lexicon)).toBe(
      'bobolian cak kadag dajis',
    );
  });

  it('keeps strong ensemble consensus for non-dictionary tokens', () => {
    expect(
      applyLexiconCorrections('bobolian cak kadag dajir', lexicon, [
        { language: 'sea_Latn', transcription: 'bobolian cak kadag dajir', score: 0.82 },
        { language: 'mly_Latn', transcription: 'bobolian cak kadag dajir', score: 0.81 },
        { language: 'ind_Latn', transcription: 'bobolian cak kadag dajir', score: 0.79 },
      ]),
    ).toBe('bobolian cak kadag dajir');
  });

  it('merges candidate tokens and keeps lexicon-backed output', () => {
    const merged = mergeAsrCandidateTokens(
      [
        { language: 'mly_Latn', transcription: 'bobolian cak kadag dagis', score: 0.82 },
        { language: 'ind_Latn', transcription: 'bobolian cak kadag dagis', score: 0.81 },
        { language: 'sea_Latn', transcription: 'bobolian chakkadogdajis', score: 0.53 },
      ],
      lexicon,
    );

    expect(merged?.mergedText).toBe('bobolian cak kadag dagis');
    expect(merged?.usedFallback).toBe(false);
  });

  it('builds local word replacements without splitting one token into many', () => {
    const result = buildWordReplacementResult(
      'bebolian cak kadag dagis',
      [
        {
          id: 'bobolian',
          text: 'bobolian',
          normalizedText: 'bobolian',
          tokens: ['bobolian'],
          source: 'dictionary',
        },
        {
          id: 'beko',
          text: 'beko',
          normalizedText: 'beko',
          tokens: ['beko'],
          source: 'dictionary',
        },
        {
          id: 'lian',
          text: 'lian',
          normalizedText: 'lian',
          tokens: ['lian'],
          source: 'dictionary',
        },
        { id: 'cak', text: 'cak', normalizedText: 'cak', tokens: ['cak'], source: 'dictionary' },
        {
          id: 'kadag',
          text: 'kadag',
          normalizedText: 'kadag',
          tokens: ['kadag'],
          source: 'dictionary',
        },
        {
          id: 'dajis',
          text: 'dajis',
          normalizedText: 'dajis',
          tokens: ['dajis'],
          source: 'dictionary',
        },
      ],
      [
        { language: 'ind_Latn', transcription: 'bebolian cak kadag dagis', score: 0.84 },
        { language: 'mly_Latn', transcription: 'debolian cak kadag dagis', score: 0.8 },
        { language: 'sea_Latn', transcription: 'bebolian chaque daag daagis', score: 0.52 },
      ],
    );

    expect(result.correctedText).toBe('bobolian cak kadag dajis');
    expect(result.replacements).toEqual([
      { from: 'bebolian', to: 'bobolian', confidence: 0.55, source: 'dictionary' },
      { from: 'dagis', to: 'dajis', confidence: 0.55, source: 'dictionary' },
    ]);
  });

  it('prefers exact sentence matches and stops searching other sentence candidates', () => {
    const sentenceMatch = getTopSentenceMatch(
      '"Adeh baju hek?" Wak Tania kitanya nu itenek.',
      [
        {
          id: 'w1',
          text: 'adeh baju hek wak tania kitanya nu itenek',
          normalizedText: 'adeh baju hek wak tania kitanya nu itenek',
          tokens: ['adeh', 'baju', 'hek', 'wak', 'tania', 'kitanya', 'nu', 'itenek'],
          source: 'webonary_sentence',
          headword: 'adeh',
        },
        {
          id: 'w2',
          text: 'adeh senarei muh mai de naiha et nu langkawi ku gecek depan',
          normalizedText: 'adeh senarei muh mai de naiha et nu langkawi ku gecek depan',
          tokens: [
            'adeh',
            'senarei',
            'muh',
            'mai',
            'de',
            'naiha',
            'et',
            'nu',
            'langkawi',
            'ku',
            'gecek',
            'depan',
          ],
          source: 'webonary_sentence',
          headword: 'senarei',
        },
      ],
      'story',
    );

    expect(sentenceMatch?.best.matchType).toBe('exact');
    expect(sentenceMatch?.best.applied).toBe(true);
    expect(sentenceMatch?.ranked).toHaveLength(1);
  });

  it('aggressively snaps to a trusted sentence when the match is strong enough', () => {
    const sentenceMatch = getTopSentenceMatch(
      'bebolian cak kadag dagis',
      [
        {
          id: 'r1',
          text: 'bobolian cak kadag dajis',
          normalizedText: 'bobolian cak kadag dajis',
          tokens: ['bobolian', 'cak', 'kadag', 'dajis'],
          source: 'verified_recording',
          headword: null,
        },
      ],
      'story',
    );

    expect(sentenceMatch?.best.semai).toBe('bobolian cak kadag dajis');
    expect(sentenceMatch?.best.applied).toBe(true);
  });
});

describe('verified recording corpus extraction', () => {
  it('keeps only verified Semai text for runtime lexicon input', () => {
    expect(
      buildVerifiedRecordingTermsFromRows([
        {
          is_verified: true,
          verified_transcription: 'bobolian cak kadag dajis',
          transcription: 'old mirror value',
        },
        {
          is_verified: true,
          verified_transcription: null,
          transcription: 'abah',
        },
        {
          is_verified: false,
          verified_transcription: 'should not be used',
          transcription: 'should not be used',
        },
      ]),
    ).toEqual(['bobolian cak kadag dajis', 'abah']);
  });
});
