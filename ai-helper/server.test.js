import { describe, expect, it } from 'vitest';

import {
  applyLexiconCorrections,
  buildAsrLanguageOrder,
  buildRuntimeConfig,
  chooseBestAsrCandidate,
  extractTranscriptionFromPayload,
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

  it('normalizes accents for lexicon comparison', () => {
    expect(normalizeLexiconText('àbɔr àbì')).toBe('abor abi');
  });

  it('applies conservative token correction from lexicon', () => {
    expect(applyLexiconCorrections('bobolian cak kadag dagis', lexicon)).toBe(
      'bobolian cak kadag dajis',
    );
  });
});
