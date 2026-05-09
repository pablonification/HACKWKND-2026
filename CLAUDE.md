# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Taleka** — a mobile-first app for learning and preserving the Semai language (an indigenous language of Malaysia). It targets two user roles: **Learners** (studying Semai) and **Elders** (recording/archiving Semai speech).

## Development Commands

```bash
# Install dependencies
npm install

# Run frontend dev server (Vite, port 5173)
npm run dev

# Run the AI transcription proxy (OmniASR, port 8787) — required for Elder Studio
npm run ai-helper:dev

# Build for production
npm run build

# Type check without emitting
npm run typecheck

# Lint (zero warnings tolerance)
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check

# Tests (watch mode)
npm run test

# Tests (single run, bail on first failure)
npm run test:run -- --bail 1

# Run a single test file
npx vitest run src/lib/translate.test.ts

# Full pre-push quality gate
npm run check

# Pre-commit (lint-staged + typecheck + tests) — runs automatically via Husky
npm run precommit
```

## Required Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable                          | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `VITE_SUPABASE_URL`               | Supabase project URL                                    |
| `VITE_SUPABASE_ANON_KEY`          | Supabase anon key                                       |
| `SUPABASE_SERVICE_ROLE_KEY`       | Service role key (used by ai-helper proxy)              |
| `VITE_PASSWORD_RESET_REDIRECT_TO` | Redirect URL after password reset                       |
| `VITE_AI_BASE_URL`                | URL for the AI proxy (default: `http://localhost:8787`) |

For the `ai-coach` Supabase Edge Function, set secrets via `supabase secrets set`:

- `GOOGLE_AI_STUDIO_API_KEY`
- `AI_COACH_GEMINI_MODEL` (e.g. `gemini-3.1-flash-lite-preview`)

## Architecture

### Frontend Stack

- **Ionic React** (`@ionic/react`) + **Capacitor** for cross-platform iOS/Android/web
- **React Router v6** for routing (inside `IonRouterOutlet`)
- **Zustand** for global state (`src/stores/`)
- **TailwindCSS** + Ionic components + per-page CSS modules
- **Vite** build, **Vitest** + Testing Library for tests
- Path alias `@` → `src/`

### Routing & User Roles

`App.tsx` initialises the Supabase session and listens for auth events → passes session to `authStore`.

`AppRouter.tsx` gates routes:

- Unauthenticated → `/auth`
- Authenticated → `/home/*`
- Password recovery flow → `/auth/reset-password`

**User roles** are stored in `user.user_metadata.role` (`learner` | `elder` | `admin`). `HomePage.tsx` renders different navigation bars based on role:

- **Learners** get a 5-tab NavBar: Home, Story, Garden (elevated center FAB), AI, Profile
- **Elders** get a 3-tab NavBar: Home, Record (elevated center FAB), Profile

### `src/lib/` — Core Business Logic

| File                 | Purpose                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `supabase.ts`        | Supabase client singleton (typed via `types/database`)                                                  |
| `auth.ts`            | Sign-in/up/out helpers                                                                                  |
| `elderStudio.ts`     | Recording lifecycle: local → Supabase `recordings` bucket, OmniASR transcription via `VITE_AI_BASE_URL` |
| `aiCoach.ts`         | AI language coach client — calls the `ai-coach` Edge Function                                           |
| `translate.ts`       | Semai ↔ Malay/English translation via `ai-translate` Edge Function                                      |
| `gardenSync.ts`      | Supabase sync for vocab progress; derives level info from `progress` table                              |
| `gardenGlossary.ts`  | Loads the bundled Semai dictionary (from `supabase/functions/_shared/webonaryGlossary.generated.ts`)    |
| `semaiDictionary.ts` | Dictionary lookup helpers                                                                               |
| `semaiText.ts`       | Semai text normalisation (`normalizeSemaiKey`)                                                          |
| `useUserLevel.ts`    | Hook returning level label, XP percentage, and `refresh()`                                              |
| `storage.ts`         | Capacitor Preferences wrapper with typed `STORAGE_KEYS`                                                 |
| `feedback.ts`        | `triggerHapticFeedback()` — wraps Capacitor Haptics                                                     |

### `src/utils/`

| File                 | Purpose                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `profileProgress.ts` | Derives XP, level label, and `percentToNext` from raw stats — used by `gardenSync.ts` and profile pages |
| `authValidation.ts`  | Auth form validation helpers                                                                            |
| `authErrors.ts`      | Maps Supabase auth error codes to user-facing messages                                                  |

### Gamification / Levels

XP = `wordsLearned × 4`. Thresholds (in `gardenSync.ts`):

- **Seed** → 0 words (default)
- **Sprout** → ≥ 1 word
- **Sapling** → ≥ 125 words
- **Tree** → ≥ 300 words

Progress is tracked in the Supabase `progress` table (`mastery_level > 0` counts as learned).

### `ai-helper/` — Local Transcription Proxy

A plain Node.js HTTP server (`server.js`) with **no LLM calls**. The entire post-processing pipeline is algorithmic:

1. Sends audio to **OmniASR** (Hugging Face) in 4 languages in parallel (`sea_Latn`, `mly_Latn`, `ind_Latn`, `eng_Latn`) — ensemble transcription
2. Scores candidates by dictionary coverage (48%), phrase support (22%), cross-candidate consensus (27%)
3. Merges candidates token-by-token via weighted alignment
4. Snaps the draft to a known Webonary sentence if similarity ≥ 0.72
5. Falls back to word-level Levenshtein correction against the verified lexicon

The lexicon is built at runtime from: curated terms (`semaiLexicon.js`) + local Webonary JSON + Supabase `words` table + verified `recordings` rows. It is cached for 5 minutes.

### Supabase Edge Functions (`supabase/functions/`)

- `ai-coach/` — Gemini-powered personal language coach with session/turn management
- `ai-translate/` — Semai ↔ Malay/English translation
- `seed-words/` — Populates initial dictionary data
- `_shared/` — **The static Semai corpus.** Both `ai-coach` and `ai-translate` import `webonaryGlossary.generated.ts` and `webonarySentenceExamples.generated.ts` as compiled TypeScript constants. Updating the glossary means re-running the dictionary pipeline scripts and redeploying the Edge Functions.

### AI Inference Design Philosophy

All three AI features share the same safety principle: **the LLM is the last resort, not the first.**

**ai-translate priority chain:**

1. Exact glossary match → return immediately, no LLM called
2. Exact sentence example match → return immediately, no LLM called
3. LLM call (Cerebras primary, SEA-LION optional secondary) with glossary terms injected as constraints
4. Post-generation: if the LLM's output doesn't contain the required glossary terms, it is discarded and replaced with a word-by-word glossary translation
5. If the Semai output contains too many Malay/Indonesian tokens and zero known Semai terms, it is discarded (`NO_GUESS_SEMAI_MODE`, on by default)
6. Hard fallback: word-by-word glossary

**ai-coach priority chain:**

1. Deterministic regex rules handle greetings, exit intent, translation requests, sentence requests, and known Semai words before the LLM is consulted
2. If rules don't match: one Gemini call classifies intent (JSON mode, ~96 tokens)
3. For learning turns: a verified Semai word/sentence is picked from the bundled corpus — the LLM is not asked to generate Semai
4. Optional second Gemini call produces coaching metadata (coach note, follow-up prompt, pronunciation tip)
5. If that output contains invented Semai phrases, it is silently replaced with a static fallback
6. A 2200ms CPU guard skips LLM stages if the request budget is nearly exhausted

This means: **do not add LLM calls to the translation or grounding path without also adding post-generation validation against the corpus.**

### Dictionary Pipeline (`scripts/`)

The Semai dictionary is scraped from Webonary and bundled at build time:

```bash
npm run scrape:dictionary       # scrapes Webonary → raw JSON
npm run parse:dictionary        # parses raw JSON
npm run build:dictionary-glossary    # generates webonaryGlossary.generated.ts
npm run build:dictionary-sentences   # generates sentence examples
npm run eval:translation        # evaluates translation quality
```

## Workflow Rules

- All changes to `main` must go through a PR — direct push is blocked
- Only `pablonification` can merge PRs to main
- Greptile AI reviews all PRs; minimum confidence score: **4/5** required
- Run `npm run precommit` before pushing (Husky enforces this on commit)
- Avoid `any` in TypeScript unless strongly justified
- Use commit prefix convention: `feat:`, `fix:`, `chore:`, `docs:`

## UX & Animation Standards

- Interactive elements must have touch feedback
- Micro-animations: ~100–220ms, natural easing (button press, transitions, input focus)
- Haptic feedback on primary taps, success states, errors, and toggles — match intensity to action importance
- Respect reduced-motion accessibility preferences
