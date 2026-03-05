/**
 * Parsing tool for the Semai dictionary data scraped from Webonary.
 *
 * Reads:  docs/plan/source/webonary-semai-all.json  (raw API output)
 * Writes: docs/plan/source/webonary-semai-parsed.json  (flat, clean format)
 *         docs/plan/source/webonary-semai-parsed.csv   (optional, via `export csv`)
 *
 * CLI usage:
 *   node scripts/parse-webonary.mjs                    # normalize and save parsed JSON
 *   node scripts/parse-webonary.mjs lookup <word>      # exact word lookup
 *   node scripts/parse-webonary.mjs search <query>     # full-text search
 *   node scripts/parse-webonary.mjs stats              # dictionary statistics
 *   node scripts/parse-webonary.mjs export csv         # export to CSV
 *
 * Parsed entry shape:
 * {
 *   id: string,
 *   word: string,          // primary headword (Semai)
 *   words: string[],       // all headwords (some entries have variants)
 *   letter: string,
 *   pos_ms: string,        // part of speech in Malay (e.g. "kata sifat")
 *   pos_en: string,        // part of speech in English (e.g. "adjective")
 *   morph: string,         // morphological type abbreviation (e.g. "awl")
 *   senses: [{
 *     definition_en: string,
 *     definition_ms: string,
 *     examples: [{
 *       semai: string,
 *       en: string,
 *       ms: string,
 *     }]
 *   }]
 * }
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SOURCE = path.join(process.cwd(), 'docs/plan/source/webonary-semai-all.json');
const OUT_JSON = path.join(process.cwd(), 'docs/plan/source/webonary-semai-parsed.json');
const OUT_CSV = path.join(process.cwd(), 'docs/plan/source/webonary-semai-parsed.csv');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Pick a value from a [{lang, value}] array by language code. */
const byLang = (arr = [], lang) => arr.find((x) => x.lang === lang)?.value ?? '';

/** Escape a CSV field value. */
const csvField = (v) => {
  if (v == null) return '';
  const s = String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
};

// ── Normalizer ────────────────────────────────────────────────────────────────

function normalizeEntry(raw) {
  const words = (raw.mainheadword ?? [])
    .map((h) => byLang(h.value != null ? [h] : raw.mainheadword, 'sea') || h.value)
    .filter(Boolean);

  // mainheadword entries have shape {lang, guid, value} — pick sea lang across array
  const seaWords = (raw.mainheadword ?? [])
    .filter((h) => h.lang === 'sea')
    .map((h) => h.value)
    .filter(Boolean);

  const headwords = seaWords.length > 0 ? seaWords : words;

  const morphtypes = raw.morphosyntaxanalysis?.morphtypes ?? [];
  const morph = morphtypes
    .flatMap((m) => m.abbreviation ?? [])
    .filter((a) => a.lang === 'ms')
    .map((a) => a.value)
    .join(', ');

  const graminfoname = raw.morphosyntaxanalysis?.graminfoname ?? [];

  const senses = (raw.senses ?? []).map((s) => {
    const defs = s.definitionorgloss ?? [];
    const examples = (s.examplescontents ?? []).map((ec) => {
      const ex = ec.example ?? [];
      const trContents = ec.translationcontents ?? [];
      const translations = trContents.flatMap((tc) => tc.translation ?? []);
      return {
        semai: byLang(ex, 'sea'),
        en: byLang(translations, 'en'),
        ms: byLang(translations, 'ms'),
      };
    });
    return {
      definition_en: byLang(defs, 'en'),
      definition_ms: byLang(defs, 'ms'),
      examples,
    };
  });

  return {
    id: raw.guid,
    word: headwords[0] ?? '',
    words: headwords,
    letter: raw.letterHead,
    pos_ms: byLang(graminfoname, 'ms'),
    pos_en: byLang(graminfoname, 'en'),
    morph,
    senses,
  };
}

// ── Load & parse ──────────────────────────────────────────────────────────────

async function load() {
  const raw = JSON.parse(await readFile(SOURCE, 'utf8'));
  return raw.map(normalizeEntry);
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdNormalize() {
  console.log('Parsing raw data…');
  const entries = await load();
  await writeFile(OUT_JSON, JSON.stringify(entries, null, 2), 'utf8');
  console.log(`✓ ${entries.length} entries → ${OUT_JSON}`);
}

async function cmdLookup(word) {
  if (!word) {
    console.error('Usage: parse-webonary.mjs lookup <word>');
    process.exit(1);
  }
  const entries = await load();
  const needle = word.toLowerCase().trim();
  const matches = entries.filter((e) => e.words.some((w) => w.toLowerCase() === needle));

  if (matches.length === 0) {
    console.log(`No entry found for "${word}".`);
    return;
  }

  for (const e of matches) {
    console.log(`\n─── ${e.words.join(' / ')} [${e.pos_en || e.pos_ms || '?'}] ───`);
    if (e.morph) console.log(`    morph: ${e.morph}`);
    e.senses.forEach((s, i) => {
      const idx = e.senses.length > 1 ? `${i + 1}. ` : '';
      if (s.definition_en) console.log(`  ${idx}EN: ${s.definition_en}`);
      if (s.definition_ms) console.log(`  ${idx}MS: ${s.definition_ms}`);
      s.examples.forEach((ex) => {
        if (ex.semai) console.log(`       ↳ ${ex.semai}`);
        if (ex.en) console.log(`          ${ex.en}`);
        if (ex.ms) console.log(`          ${ex.ms}`);
      });
    });
  }
}

async function cmdSearch(query) {
  if (!query) {
    console.error('Usage: parse-webonary.mjs search <query>');
    process.exit(1);
  }
  const entries = await load();
  const needle = query.toLowerCase().trim();

  const matches = entries.filter((e) => {
    const haystack = [
      ...e.words,
      e.pos_en,
      e.pos_ms,
      e.morph,
      ...e.senses.flatMap((s) => [
        s.definition_en,
        s.definition_ms,
        ...s.examples.flatMap((ex) => [ex.semai, ex.en, ex.ms]),
      ]),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(needle);
  });

  console.log(`Found ${matches.length} entries matching "${query}":\n`);
  matches.forEach((e) => {
    const defs = e.senses.map((s) => s.definition_en || s.definition_ms).filter(Boolean);
    console.log(`  ${e.word.padEnd(20)} ${defs[0] ?? ''}`);
  });
}

async function cmdStats() {
  const entries = await load();
  const byLetter = {};
  let withExamples = 0;
  let totalSenses = 0;
  const posCount = {};

  for (const e of entries) {
    byLetter[e.letter] = (byLetter[e.letter] ?? 0) + 1;
    totalSenses += e.senses.length;
    if (e.senses.some((s) => s.examples.length > 0)) withExamples++;
    const pos = e.pos_en || e.pos_ms;
    if (pos) posCount[pos] = (posCount[pos] ?? 0) + 1;
  }

  console.log(`Total entries:     ${entries.length}`);
  console.log(`Total senses:      ${totalSenses}`);
  console.log(
    `Entries w/examples:${withExamples} (${Math.round((withExamples / entries.length) * 100)}%)`,
  );
  console.log('\nParts of speech:');
  Object.entries(posCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([pos, n]) => console.log(`  ${String(n).padStart(5)}  ${pos}`));
  console.log('\nPer-letter count:');
  Object.entries(byLetter).forEach(([l, n]) => console.log(`  ${l}: ${n}`));
}

async function cmdExportCsv() {
  const entries = await load();
  const rows = [];
  const header = [
    'id',
    'word',
    'words',
    'letter',
    'pos_en',
    'pos_ms',
    'morph',
    'definition_en',
    'definition_ms',
    'example_semai',
    'example_en',
    'example_ms',
  ];
  rows.push(header.map(csvField).join(','));

  for (const e of entries) {
    // One row per sense; if multiple examples, use the first
    const senses =
      e.senses.length > 0 ? e.senses : [{ definition_en: '', definition_ms: '', examples: [] }];
    for (const s of senses) {
      const ex = s.examples[0] ?? {};
      rows.push(
        [
          e.id,
          e.word,
          e.words.join(' / '),
          e.letter,
          e.pos_en,
          e.pos_ms,
          e.morph,
          s.definition_en,
          s.definition_ms,
          ex.semai ?? '',
          ex.en ?? '',
          ex.ms ?? '',
        ]
          .map(csvField)
          .join(','),
      );
    }
  }

  await writeFile(OUT_CSV, rows.join('\n'), 'utf8');
  console.log(`✓ ${rows.length - 1} rows → ${OUT_CSV}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'lookup':
    await cmdLookup(args[0]);
    break;
  case 'search':
    await cmdSearch(args.join(' '));
    break;
  case 'stats':
    await cmdStats();
    break;
  case 'export':
    if (args[0] === 'csv') await cmdExportCsv();
    else {
      console.error('Unknown export format. Use: export csv');
      process.exit(1);
    }
    break;
  default:
    await cmdNormalize();
}
