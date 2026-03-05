# Translation Model Improvement Plan

**Feature:** AI Translation (`ai-translate` edge function)
**Status:** Draft

---

## Context

The current translation pipeline runs in order:

1. Glossary exact match → returns immediately if found
2. Glossary partial matches → builds context hints for the AI
3. SEA-LION (`aisingapore/Gemma-SEA-LION-v4-27B-IT`) via HuggingFace router → main AI path
4. Word-by-word glossary fallback → last resort

The eval set (16 cases) passes 100%, but nearly all go through the glossary — only one sentence-level case hits SEA-LION. The glossary has 14 entries. Quality degrades fast on anything outside that narrow coverage.

---

## Improvement Areas

### 0. Source-gated glossary acquisition (verified-first)

Cloudflare blocks direct scraping of the public Web pages, but this repo already has a working ingestion path through the Webonary Cloud API.

**Default ingestion path should be API-based, not manual copy-paste.**

Recommended flow:

1. Scrape via `scripts/scrape-webonary.mjs` into raw per-letter JSON files (`docs/plan/source/webonary-semai-{letter}.json`)
2. Normalize via `scripts/parse-webonary.mjs` into `docs/plan/source/webonary-semai-parsed.json`
3. Convert parsed entries into glossary candidates with provenance metadata
4. Mark imported entries as `provisional`
5. Promote to production glossary only after reviewer validation

Manual copy-paste or HTML capture is fallback-only if the API is unavailable.

Required metadata per term:

- `source_name` (for example: `webonary-semai`)
- `source_url` (original browse or entry URL)
- `source_letter` (`a`-`z`)
- `date_accessed`
- `license_status` (`unknown`, `pending-approval`, `approved`)
- `review_status` (`provisional`, `validated`, `rejected`)
- `reviewer`
- `review_notes`

Source acceptance policy:

- **Verified**: `docs/final` references and validated community-reviewed terms
- **Provisional**: Webonary API candidates awaiting review
- **Rejected**: conflicting forms, unclear meaning, or unverified Semai-specific terms

> Hard rule: never guess Semai forms. If uncertain, keep term provisional or reject.
>
> Data handling note: use `docs/plan/source/webonary-semai-parsed.json` as the default source artifact; only fall back to `webonary-semai-all.json` for advanced extraction fields.

### 1. Expand the glossary (14 → 100+ entries)

Highest impact, lowest risk. More entries means better AI context hints AND better fallback coverage.

Semai shares significant vocabulary with Malay (loanwords), so many additions would have `semai === ms`. Categories to cover:

- **Numbers** — satu, dua, tiga, empat, lima, enam, tujuh, lapan, sembilan, sepuluh
- **Pronouns** — saya (I/me), awak (you), dia (he/she), mereka (they)
- **Family/kinship** — bapa (father), ibu (mother), abang (older brother), adik (younger sibling), kakak (older sister), nenek (grandmother), datuk (grandfather)
- **Nature** — batu (stone), tanah (earth), sungai (river), pokok (tree), matahari (sun), bulan (moon), bunga (flower), buah (fruit)
- **Animals** — ular (snake), burung (bird), ikan (fish), gajah (elephant), kera (monkey), buaya (crocodile)
- **Food/actions** — nasi (cooked rice), padi (paddy), makan (eat), minum (drink), tidur (sleep), jalan (walk/road)
- **House/building** — bubung (roof), tiang (post), pintu (door), tangga (stairs) — referenced in TUYANG Language Garden
- **More phrases** — selamat tinggal (goodbye), tolong (please/help), ya (yes), tidak (no)

> Note: only add entries where the Semai form is documented or is a confirmed Malay loanword. Do not guess Semai-specific forms.

Files to edit:
- `supabase/functions/_shared/translationGlossary.ts`
- `supabase/functions/_shared/translationGlossary.test.ts` (add coverage for new entries)

---

### 2. Improve prompt engineering

The current system prompt is a single sentence. A stronger version would give the model real context.

**System prompt improvements:**
- Describe Semai: Aslian language family, uses Latin script, borrows heavily from Malay, ~30,000 speakers, endangered
- Instruct the model to preserve cultural terms (`bobolian`, `bobohiz`, `tong`) in their Semai form when the target language has no equivalent
- Add explicit guardrail: when confidence is low for Semai target output, do not invent terms; return best-effort translation with warning
- Stricter output rules: no quotes, no "Translation:" prefix, no alternatives, no explanations

**User prompt improvements:**
- Add few-shot examples per language pair to anchor output style:
  - `semai→en`: "bobolian pergi ke hutan" → "the traditional healer goes to the forest"
  - `ms→en`: "dia makan nasi" → "he eats rice"
  - `en→semai`: "the child is at home" → "anak ada di rumah"
- Keep glossary hints as-is (already well-structured)

Files to edit:
- `supabase/functions/ai-translate/index.ts` (`translateWithSeaLion` function)

---

### 3. Increase `max_tokens`

Currently capped at `220`. This silently truncates longer inputs — the model stops mid-sentence and returns a partial translation that passes the empty-check but is wrong.

Raise to `512` minimum, or `1024` for headroom.

Do not assume cost impact is negligible. Track and compare before/after:

- latency (`p50`, `p95`)
- input tokens, output tokens, total tokens
- provider/model used
- warning/fallback rate

Files to edit:
- `supabase/functions/ai-translate/index.ts`

---

### 4. Route to a stronger model (optional, requires API key)

SEA-LION is optimised for high-resource SEA languages. Semai is extremely low-resource — GPT-4o-mini or Claude 3.5 Haiku would produce better sentence-level translations due to stronger instruction-following and language generalisation.

**Proposed routing logic:**

```
if OPENAI_API_KEY is set → try GPT-4o-mini first
else → try SEA-LION
→ on failure → word-by-word fallback
```

Zero breaking changes: SEA-LION remains the default. OpenAI only activates if the env var is present.

Env vars to add to Supabase:
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional override, defaults to `gpt-4o-mini`)

Files to edit:
- `supabase/functions/ai-translate/index.ts` (add `translateWithOpenAI`, update routing)

---

### 5. Tighten glossary enforcement

`areGlossaryTermsSatisfied` currently uses `String.includes()` — this can produce false positives (e.g. "fire" matching inside "firefly" or "fired"). The file already has a proper `containsTerm` function using word-boundary regex. Use that instead.

This prevents incorrect fallback triggers when the output is actually valid.

Files to edit:
- `supabase/functions/_shared/translationGlossary.ts` (`areGlossaryTermsSatisfied`)

---

### 6. Expand evaluation into 3 tiers with release gates

Use explicit tiers to avoid overfitting to dictionary-only tests:

- **Tier A (critical glossary integrity)**: protected cultural terms and must-keep mappings
- **Tier B (short sentence quality)**: core grammar and phrase-level semantic accuracy
- **Tier C (long robustness)**: paragraph-length, truncation behavior, fallback/warning correctness

Release gates:

- Tier A must remain `100%`
- Any critical failure blocks release
- If warning/fallback rate spikes above baseline, hold release pending review

Files to edit:
- `docs/final/SEMAI_TRANSLATION_EVAL_SET.json`
- `scripts/evaluate-translation.mjs`
- `docs/final/SEMAI_TRANSLATION_REVIEW.md`

---

## Priority Order

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | Source-gated ingestion policy (API-first) | High | Low |
| 2 | Enforcement fix | High | Trivial |
| 3 | Prompt engineering (`don't guess`) | High | Low |
| 4 | Increase `max_tokens` + telemetry | Medium | Low |
| 5 | Glossary expansion (verified first) | High | Medium |
| 6 | Tiered eval and release gates | High | Medium |
| 7 | Stronger model routing | High | Medium |

Recommended sequence:

1. Define source policy and ingestion metadata (API-first path)
2. Fix glossary enforcement logic first
3. Add no-guess prompt/fallback behavior
4. Raise token cap and measure latency/cost impact
5. Expand glossary from verified sources (`docs/final` first, then provisional Webonary API batches)
6. Upgrade eval set to Tier A/B/C and enforce gates
7. Add optional model routing once baseline is stable
