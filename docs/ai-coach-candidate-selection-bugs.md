# AI Coach: Candidate Selection Bugs

Investigation and root-cause analysis for broken word/sentence selection in the AI coach learning flow.

## Symptoms

- Clicking "Continue" repeatedly shows the same ~5 basic words (air, api, anak) that are Malay loanwords identical in both languages.
- Choosing a topic like "food" does not produce food-related vocabulary — instead shows an unrelated sentence.
- The 26,000+ genuine Semai words from Webonary are effectively invisible.

## Bug 1: Topic Selection Ignored in Candidate Scoring

### Flow

1. User types "food" during onboarding.
2. `extractTopicHint("food")` returns `'food vocabulary'` (coachTopic.ts:60).
3. Onboarding handler acknowledges: "Great, I noted your focus: food vocabulary."
4. Topic stored as `topic_hint` in response metadata (index.ts:1662).
5. User clicks Start → `scenario_start` turn.

### Problem

`pickVerifiedLearningCandidate` (index.ts:807) does NOT receive the topic hint. It calls `buildLearningSeed` which reconstructs context from the raw message and turn history. The topic classification happens *separately* in `inferLearningCategories` via keyword matching on the seed text.

Worse: `scenario_start` **always** prioritizes sentence candidates over glossary (index.ts:830-834):

```typescript
const prioritized =
  track === 'daily_conversation' ||
  intent.turnType === 'sentence_help' ||
  intent.turnType === 'scenario_start'     // <-- sentences first on first turn
    ? [...sentenceCandidates, ...glossaryCandidates]
    : [...glossaryCandidates, ...sentenceCandidates];
```

Sentence candidates are scored by token overlap — so the sentence "'Meow, meow,' my cat cries for food" scores well because "food" appears in the English translation, even though it teaches nothing about food vocabulary.

### Result

User asks for food → gets a cat sentence tangentially mentioning food.

## Bug 2: Curated MVP Entries Always Win Over Webonary

### Scoring in `buildGlossaryCandidates` (index.ts:747-782)

| Factor | Curated MVP entry | Webonary entry |
|--------|-------------------|----------------|
| Source bonus | **+4** (`translation mvp`) | +2 (`webonary`) |
| Category match | **+4** if `nature/family/food/phrase` | **0** (Webonary uses `kata nama`, `kata kerja`, `kata sifat`, `webonary` — NONE match) |
| **Total** | **8** | **2** |

### Category mismatch

`DEFAULT_TRACK_CATEGORIES` uses semantic English categories:
```typescript
{ vocabulary_first: ['nature', 'family', 'food', 'phrase'] }
```

Webonary entries use Malay grammar categories:
```
'kata nama' (noun), 'kata kerja' (verb), 'kata sifat' (adjective), 'webonary'
```

Zero overlap → zero category bonus → Webonary always loses.

### Curated entries are Malay loanwords

The curated glossary (`CURATED_SEMAI_GLOSSARY`) has ~15 entries. Most are Malay words identical in Semai:

```
{ semai: 'air',   ms: 'air',   en: 'water', category: 'nature' }
{ semai: 'api',   ms: 'api',   en: 'fire',  category: 'nature' }
{ semai: 'anak',  ms: 'anak',  en: 'child', category: 'family' }
```

Only a few (bobolian, bobohiz, tong) are genuinely distinct Semai words.

### Result

The same ~15 curated Malay loanwords always occupy the top-20 candidates. The 26,000+ real Semai words from Webonary (abei=mother, abek=father, abat=cloth, etc.) never surface.

## Bug 3: Dedup Window Too Small

`collectRecentAssistantSemaiTexts` (coachGrounding.ts:96-107) only tracks the last **6** assistant messages. With ~15 curated entries cycling through, words start repeating after 2-3 "Continue" clicks.

## Bug 4: `continue_session` Seed Falls Back to Generic String

When `clientAction === 'continue_session'`, `buildLearningSeed` (coachGrounding.ts:49-94):

1. Skips the current message entirely (line 64).
2. Scans turn history for last non-control user message.
3. If none found → returns `'vocabulary'` / `'daily conversation'` / `'pronunciation practice'`.

These generic strings produce the same default categories every time:
```
'vocabulary' → ['nature', 'family', 'food', 'phrase']  (always the same)
```

No randomization, no category rotation, no topic memory.

## Bug 5: No Randomization

`buildGlossaryCandidates` sorts by score descending (line 781), takes top 20 (line 827), then picks the first unseen (line 840-842). Since scores are deterministic and the sort is stable, the same entries always appear in the same order.

## Files Involved

| File | Role |
|------|------|
| `supabase/functions/ai-coach/index.ts` | Main edge function. Candidate scoring, selection, response assembly. |
| `supabase/functions/_shared/coachGrounding.ts` | `buildLearningSeed`, `collectRecentAssistantSemaiTexts`, dedup logic. |
| `supabase/functions/_shared/coachTopic.ts` | `inferScenarioTopic`, `extractTopicHint` — topic detection. |
| `supabase/functions/_shared/translationGlossary.ts` | `SEMAI_GLOSSARY`, `SEMAI_SENTENCE_EXAMPLES` — verified data sources. |
| `supabase/functions/_shared/webonaryGlossary.generated.ts` | 26,000+ lines of Webonary Semai dictionary data. |
| `supabase/functions/_shared/webonarySentenceExamples.generated.ts` | Webonary sentence examples. |

## Key Functions (index.ts)

| Function | Line | Purpose |
|----------|------|---------|
| `pickVerifiedLearningCandidate` | 807-844 | Selects which word/sentence to teach. THE function that needs fixing. |
| `buildGlossaryCandidates` | 747-782 | Scores all glossary entries by category match and source quality. |
| `buildSentenceCandidates` | 784-805 | Scores sentence examples by token overlap. |
| `inferLearningCategories` | 724-745 | Maps message keywords to categories. |
| `buildVerifiedLearningTranslationResult` | 1394-1419 | Wraps candidate into translation result. |
| `DEFAULT_TRACK_CATEGORIES` | 718-722 | Default categories per learning track. |

## Fix Plan

1. **Pass topic hint into candidate selection** — `pickVerifiedLearningCandidate` should receive and use the inferred topic, not reconstruct it from raw text.
2. **Map Webonary categories** — Create a mapping from Malay grammar categories (`kata nama` → noun-related semantic categories) so Webonary entries can match track categories.
3. **Rebalance source scoring** — Remove or reduce the +4 MVP source bonus. Webonary entries with distinct Semai forms should score higher than Malay-identical curated entries.
4. **Add randomization** — Shuffle within score tiers so the same entries don't always appear first.
5. **Expand dedup window** — Track all shown words in the session, not just last 6 turns.
6. **Improve continue_session seed** — Use topic from session history, rotate categories, or pick random category on each continue.
7. **Don't force sentences on scenario_start** — Respect the user's track choice. If `vocabulary_first`, show vocabulary first.

---

## Fixes Applied

### Fix A: Direct Word Lookup for `word_help` Intent (deployed, v35)

**Problem**: When a user typed a Semai word in chat, the `word_help` intent used `pickVerifiedLearningCandidate`, which shuffles glossary candidates randomly and returns unrelated words.

**Root cause**: `buildVerifiedLearningTranslationResult` -> `pickVerifiedLearningCandidate` is designed for learning flow variety, not exact lookup. It scores by category and picks the first unseen candidate.

**Fix** (`supabase/functions/ai-coach/index.ts`, `buildLearningPayload`):
1. `word_help` now takes a dedicated lookup path:
   - Direct glossary lookup via `findExactGlossaryTranslation`
   - Fallback to sentence memory via `findExactSentenceExampleTranslation`
   - Last resort: AI translation via `translateGroundedText`
2. Only uses the random candidate picker for non-word-help intents.

**Verified**: dajis->midday, kadag->snakehead murrel, cak->eat, muj->edible palm pith, merip->how much/many.

### Fix B: Deterministic Sentence Request Detection (deployed)

**Problem**: Asking "sentence please" or "give me a sentence in semai example" returned the generic fallback "Hi. I can help with Semai coaching..." instead of a Semai sentence.

**Root cause**: `resolveIntentWithPlanner` calls Gemini LLM to classify intent. For bare sentence requests, the LLM sometimes returns `mode: 'direct_help'` / `turn_type: 'direct_answer'`, which routes to `buildDirectHelpPayload` -> `buildDirectHelpFallback` (generic message).

The existing deterministic check `isLearningNextStepIntent` requires BOTH a continuation word (next/another/more/new) AND a content word (sentence/example) -- so "sentence please" fails.

**Fix** (`supabase/functions/ai-coach/index.ts`):
1. Added `isSentenceRequestIntent` -- detects "sentence", "phrase", "ayat", "frasa" as standalone triggers, and "example"/"contoh" when paired with Semai/learning context.
2. Inserted as deterministic check in `resolveIntentWithPlanner` before the LLM call, returning `mode: 'learning'` / `turnType: 'sentence_help'` with `confidence: 'high'`.
3. This routes to `buildLearningPayload` -> `buildVerifiedLearningTranslationResult` -> `pickVerifiedLearningCandidate` which finds sentence candidates from `SEMAI_SENTENCE_EXAMPLES`.

### Fix C: Parser Extracts Subentries / Complex Forms (deployed)

**Problem**: Complex/derived forms like "caknak" (food), "canak" (rice), "cakcak" (to eat) were missing from the glossary. The user correctly identified the parser wasn't reading all the scraped data.

**Root cause**: The raw Webonary data stores derived forms as `subentries[]` inside parent entries, using numbered field variants:
- `headword-4` (instead of `mainheadword`)
- `senses-2` (instead of `senses`)
- `definitionorgloss-2` (instead of `definitionorgloss`)
- `examplescontents-2`, `example-2`, `translationcontents-2`, `translation-2`
- `morphosyntaxanalysis-2.graminfoname-2`

The parser only read top-level `mainheadword`/`senses`/etc., so all 417 subentries were invisible.

Additionally, 458 `minorentrycomplex` and 137 `minorentryvariant` entries are cross-reference stubs with NO definitions -- they just point back to parent entries. The real data lives in parent `subentries[]`.

**Fix** (`scripts/parse-webonary.mjs`):
1. Added `normalizeSubentry(sub, parentRaw)` that reads the numbered-variant fields.
2. Modified `load()` to iterate parent subentries and produce separate parsed entries for each.
3. Skips `minorentrycomplex` and `minorentryvariant` stubs (no definitions to extract).

**Result**:
- Before: 3,901 entries (3,306 real + 595 stubs with no definitions)
- After: 3,723 entries (3,306 parent + 417 subentries, all with definitions)
- Glossary: 3,307 -> 3,707 entries (+400)
- Sentence examples: 3,140 -> 3,473 (+333)
- caknak -> food, canak -> rice, cakcak -> to eat now work in chat.

### Fix D: Bare Semai Word During Active Learning Gets Generic Fallback (deployed, v36)

**Problem**: Typing a bare Semai word like "wig" during an active learning session returned the generic fallback "Hi. I can help with Semai coaching..." instead of translating the word. The system treated each new message as a fresh session.

**Root cause**: `isExactVerifiedSemaiInput("wig")` returned `false` because "wig" is a **polysemous word** with 2 meanings in the glossary (banyan tree / shout). `findExactGlossaryTranslation` intentionally returns `null` when `uniqueTargets.length !== 1` to avoid ambiguity. This broke two things:

1. **Intent routing**: The deterministic checks in `resolveIntentWithPlanner` all missed "wig". The LLM planner classified it as `mode: 'direct_help'`, and `applySessionPolicy` couldn't override because `isExactVerifiedSemaiInput` returned false.
2. **Translation lookup**: Even if routing succeeded, `buildLearningPayload`'s word_help path used `findExactGlossaryTranslation` which returns null for polysemous words.

The cascade: deterministic checks fail -> LLM misclassifies -> policy override fails -> generic fallback.

**Fix** (three layers across 3 files):

1. **`translationGlossary.ts`** -- Added 3 new exported functions:
   - `hasGlossaryEntry(text, from)` -- returns `true` if ANY glossary entry matches, regardless of translation count
   - `findFirstGlossaryTranslation(text, from, to)` -- returns first matching translation (ignores polysemy)
   - `findAllGlossaryTranslations(text, from, to)` -- returns all unique translations as `string[]`

2. **`coachGrounding.ts`** -- Updated `isExactVerifiedSemaiInput` to check `hasGlossaryEntry` FIRST (before `findExactGlossaryTranslation`), so polysemous words are recognized as valid Semai input.

3. **`supabase/functions/ai-coach/index.ts`** -- Two changes:
   - Added deterministic check in `resolveIntentWithPlanner` (line ~1233): if `currentPhase === 'learning_active' && hasGlossaryEntry(message, 'semai')`, return `word_help` immediately (skips LLM entirely).
   - Updated `buildLearningPayload` word_help else-branch: when `findExactGlossaryTranslation` returns null, tries `findAllGlossaryTranslations` for polysemous words -- joins all meanings with `; ` and marks as `model: 'exact-lookup-multi'`.

**Verified**:
- Polysemous: wig -> "banyan tree; shout" (both meanings shown, `model: exact-lookup-multi`)
- Non-polysemous: cak -> "eat" (single meaning, `model: exact-lookup`)
- Idle phase: bare "wig" without active session stays as `direct_help` (no false triggering)
