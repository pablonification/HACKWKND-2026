# Scripts

Three Node.js scripts that form the Semai dictionary data pipeline and translation evaluation toolchain. All scripts are ESM (`.mjs`) and require Node 18+.

## Data Pipeline Overview

```
Webonary Cloud API
      │
      ▼
scrape-webonary.mjs  ──→  docs/plan/source/webonary-semai-{letter}.json  (raw, per-letter)
                     ──→  docs/plan/source/webonary-semai-all.json        (raw, combined)
      │
      ▼
parse-webonary.mjs   ──→  docs/plan/source/webonary-semai-parsed.json    (clean, flat)
                     ──→  docs/plan/source/webonary-semai-parsed.csv     (spreadsheet-ready)
```

**Start here if the data files already exist** — you can skip directly to `parse-webonary.mjs` or query `webonary-semai-parsed.json` directly.

---

## Scripts

### `scrape-webonary.mjs` — Dictionary Scraper

Fetches all 3,901 Semai dictionary entries from the [Webonary Cloud API](https://cloud-api.webonary.org/v1) (SIL International). The public API bypasses Cloudflare protection on the main site.

**Run:**

```bash
npm run scrape:dictionary
# or
node scripts/scrape-webonary.mjs
```

**No env vars required** — the API is public and unauthenticated.

**Output** (written to `docs/plan/source/`):
| File | Description |
|------|-------------|
| `webonary-semai-{a–z}.json` | Raw API entries per letter (23 files) |
| `webonary-semai-all.json` | All entries combined (~19 MB) |

**When to re-run:** Only if you need fresher data from Webonary. The API is rate-limited with a built-in 300ms delay between requests. Full run takes ~60–90s.

**Letter coverage:** `a b c d e f g h i j k l m n o p r s t u w y z` (no q, v, x in Semai)

---

### `parse-webonary.mjs` — Dictionary Parser + CLI

Normalizes the raw Webonary API output (deeply nested `[{lang, value}]` arrays) into a flat, readable structure. Also provides CLI lookup/search commands for interactive use.

**Run (normalize and save):**

```bash
npm run parse:dictionary
# or
node scripts/parse-webonary.mjs
```

**CLI commands:**

```bash
# Exact word lookup
node scripts/parse-webonary.mjs lookup <word>

# Full-text search across all fields (word, definition, examples, POS)
node scripts/parse-webonary.mjs search <query>

# Dictionary statistics (entry count, POS breakdown, per-letter counts)
node scripts/parse-webonary.mjs stats

# Export to CSV (one row per sense)
node scripts/parse-webonary.mjs export csv
```

**Examples:**

```bash
node scripts/parse-webonary.mjs lookup doh
node scripts/parse-webonary.mjs search tiger
node scripts/parse-webonary.mjs stats
node scripts/parse-webonary.mjs export csv
```

**Output** (written to `docs/plan/source/`):
| File | Description |
|------|-------------|
| `webonary-semai-parsed.json` | Flat normalized entries (3,901 items) |
| `webonary-semai-parsed.csv` | One row per sense (4,101 rows incl. header) |

**Reads from:** `docs/plan/source/webonary-semai-all.json` — run the scraper first if this file is missing.

#### Parsed Entry Schema

```ts
interface ParsedEntry {
  id: string; // Webonary GUID
  word: string; // Primary Semai headword (e.g. "doh")
  words: string[]; // All headwords — some entries have variants
  letter: string; // First letter (e.g. "d")
  pos_ms: string; // Part of speech in Malay (e.g. "kata keterangan")
  pos_en: string; // Part of speech in English (e.g. "adverb")
  morph: string; // Morphological type abbreviation (e.g. "awl", "pfx")
  senses: Sense[];
}

interface Sense {
  definition_en: string; // English definition
  definition_ms: string; // Malay definition
  examples: Example[];
}

interface Example {
  semai: string; // Example sentence in Semai
  en: string; // English translation of example
  ms: string; // Malay translation of example
}
```

**Coverage facts:**

- 3,901 total entries
- 185 entries have multiple senses
- 522 entries have multiple headword variants
- 75% of entries include example sentences
- 595 entries have only a Malay definition (no English)

---

### `evaluate-translation.mjs` — Translation Evaluator

Runs a set of test cases against the live `ai-translate` Supabase edge function and produces a Markdown report of pass/fail results.

**Run:**

```bash
npm run eval:translation
# or
node scripts/evaluate-translation.mjs
```

**Required env vars** (from `.env` or environment):

```
VITE_SUPABASE_URL   or  SUPABASE_URL
VITE_SUPABASE_ANON_KEY  or  SUPABASE_ANON_KEY
```

**Reads:** `docs/final/SEMAI_TRANSLATION_EVAL_SET.json`  
**Writes:** `docs/final/SEMAI_TRANSLATION_EVAL_REPORT.md`

**Exit codes:**

- `0` — all tests passed (or no critical failures)
- `1` — fatal error (missing env, invalid eval set)
- `2` — one or more critical test cases failed

**Test case shape:**

```json
{
  "id": "tc-001",
  "priority": "critical",
  "from": "sea",
  "to": "en",
  "input": "doh",
  "expected": "later",
  "match": "contains"
}
```

`match` can be `"exact"` (normalized string equality) or `"contains"` (expected is a substring of output).

---

## Data Files Reference

All data files live in `docs/plan/source/`.

| File                           | Size   | Use this when…                                                         |
| ------------------------------ | ------ | ---------------------------------------------------------------------- |
| `webonary-semai-parsed.json`   | ~5 MB  | **Default choice.** Clean, flat, easy to parse.                        |
| `webonary-semai-parsed.csv`    | ~2 MB  | Loading into spreadsheets, SQL, pandas, etc.                           |
| `webonary-semai-all.json`      | ~19 MB | Need raw API fields (e.g. `displayXhtml`, `searchTexts`, `updatedAt`). |
| `webonary-semai-{letter}.json` | varies | Processing one letter at a time to manage memory.                      |

**Prefer `webonary-semai-parsed.json`** for most tasks — it has everything you need without the noise.

---

## Adding New Test Cases

Edit `docs/final/SEMAI_TRANSLATION_EVAL_SET.json` directly. The array structure is self-documenting. Use `priority: "critical"` for cases that must pass for the feature to be considered working.
