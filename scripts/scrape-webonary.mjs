/**
 * Scrapes the Semai dictionary from the Webonary Cloud API.
 *
 * The site (webonary.org) has Cloudflare bot protection, but SIL International
 * exposes a public Cloud API at cloud-api.webonary.org/v1 that serves the same
 * data in JSON format with no bot protection.
 *
 * API endpoint: GET https://cloud-api.webonary.org/v1/browse/entry/:dictionaryId
 * Params:
 *   text        - letter head (e.g. "a", "b")
 *   pageNumber  - 1-indexed (default 1)
 *   pageLimit   - max 100 (default 100)
 *   countTotalOnly - 1 to return count only
 *
 * Output:
 *   docs/plan/source/webonary-semai-{letter}.json  — raw entries per letter
 *   docs/plan/source/webonary-semai-all.json        — all entries combined
 *   docs/plan/source/webonary-semai-{letter}.html   — HTML browse page (matching existing format)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DICTIONARY_ID = 'semai';
const BASE_URL = `https://cloud-api.webonary.org/v1/browse/entry/${DICTIONARY_ID}`;
const PAGE_LIMIT = 100;
const DELAY_MS = 300; // polite delay between requests
const OUT_DIR = path.join(process.cwd(), 'docs/plan/source');

// Semai uses these letters only (no q, v, x)
const LETTERS = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'r',
  's',
  't',
  'u',
  'w',
  'y',
  'z',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchCount(letter) {
  const url = `${BASE_URL}?text=${letter}&countTotalOnly=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching count for '${letter}'`);
  const { count } = await res.json();
  return count;
}

async function fetchPage(letter, pageNumber) {
  const url = `${BASE_URL}?text=${letter}&pageLimit=${PAGE_LIMIT}&pageNumber=${pageNumber}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching '${letter}' page ${pageNumber}`);
  return res.json();
}

async function fetchAllForLetter(letter) {
  const count = await fetchCount(letter);
  console.log(`  ${letter}: ${count} entries`);

  if (count === 0) return [];

  const totalPages = Math.ceil(count / PAGE_LIMIT);
  const allEntries = [];

  for (let page = 1; page <= totalPages; page++) {
    if (page > 1) await sleep(DELAY_MS);
    const entries = await fetchPage(letter, page);
    allEntries.push(...entries);
    if (totalPages > 1) {
      process.stdout.write(`    page ${page}/${totalPages} (${entries.length} entries)\n`);
    }
  }

  return allEntries;
}

function buildHtmlPage(letter, entries) {
  // Build the letter navigation bar
  const letterLinks = LETTERS.map(
    (l) =>
      `<div class="lpTitleLetterCell"><span><a class="lpTitleLetter${l === letter ? ' current' : ''}" href="?key=sea&amp;letter=${l}">${l}</a></span></div>`,
  ).join('');

  // Build entry HTML from displayXhtml fields
  const entryBlocks = entries
    .map((e) => `<div class="post">${e.displayXhtml ?? ''}</div>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Semai Dictionary &raquo; Browse Semai &raquo; ${letter.toUpperCase()}</title>
</head>
<body>
<div class="fullwidth">
  <div class="pageentry">
    <h1>Browse Semai</h1>
    <div style="text-align:center;">
      <div style="display:inline-block;" class="ltr">
        ${letterLinks}
      </div>
    </div>
    <div style="clear:both"></div>
    <div class="center"><h1 id="chosenLetterHead">${letter}</h1></div><br>
    <div id="searchresults" class="vernacular-results left">
      ${entryBlocks}
    </div>
  </div>
</div>
</body>
</html>`;
}

async function main() {
  if (!existsSync(OUT_DIR)) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  const allEntries = [];
  const summary = [];

  console.log(`Fetching Semai dictionary from ${BASE_URL}`);
  console.log(`Output directory: ${OUT_DIR}\n`);

  for (const letter of LETTERS) {
    try {
      const entries = await fetchAllForLetter(letter);
      allEntries.push(...entries);
      summary.push({ letter, count: entries.length });

      // Save per-letter JSON
      const jsonPath = path.join(OUT_DIR, `webonary-semai-${letter}.json`);
      await writeFile(jsonPath, JSON.stringify(entries, null, 2), 'utf8');

      // Save per-letter HTML (matching existing file naming convention)
      const htmlPath = path.join(OUT_DIR, `webonary-semai-${letter}.html`);
      await writeFile(htmlPath, buildHtmlPage(letter, entries), 'utf8');

      console.log(`  ✓ Saved ${entries.length} entries → ${path.basename(jsonPath)}\n`);

      if (LETTERS.indexOf(letter) < LETTERS.length - 1) {
        await sleep(DELAY_MS);
      }
    } catch (err) {
      console.error(`  ✗ Failed letter '${letter}':`, err.message);
      summary.push({ letter, count: 0, error: err.message });
    }
  }

  // Save combined JSON
  const allPath = path.join(OUT_DIR, 'webonary-semai-all.json');
  await writeFile(allPath, JSON.stringify(allEntries, null, 2), 'utf8');

  const total = summary.reduce((sum, s) => sum + s.count, 0);
  console.log('='.repeat(50));
  console.log(`Done. ${total} total entries across ${LETTERS.length} letters.`);
  console.log(`Combined JSON: ${allPath}`);
  console.log('\nPer-letter summary:');
  summary.forEach(({ letter, count, error }) => {
    const status = error ? `ERROR: ${error}` : `${count} entries`;
    console.log(`  ${letter}: ${status}`);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
