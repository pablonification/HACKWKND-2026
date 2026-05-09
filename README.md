# Taleka

<img width="1247" height="697" alt="Taleka hero banner" src="https://github.com/user-attachments/assets/74dd9377-6c60-4e1e-85bd-c296d937f9f4" />

> A mobile platform for learning and preserving endangered indigenous languages of Southeast Asia — starting with Semai (Malaysia).

---

## What's New (Post-Submission Refinements)

These features and improvements were added after the original BorNEO HackWknd 2026 submission on May 9th.

### Story Pipeline

- Elders can now **publish verified recordings as stories** directly from the Sound Archive tab
- Stories are sourced from the Supabase `recordings` table — scenes are built from `verified_transcription` split by paragraph, with `verified_translation_ms` as per-scene subtitles
- **AI-generated cover art and background images** via the `generate-story-cover` edge function (OpenRouter / GPT Image 2), using the recording's description and verified transcription as the image prompt
- New `cover_url`, `bg_url`, and `is_published` columns on the `recordings` table with RLS policies allowing uploaders to publish their own verified recordings

### Multi-Language Support & Dynamic Backgrounds

- Users can now select any of 8 indigenous ASEAN languages (Tandia · Semai · Mlabri · Chong · Arta · Arem · Kristang · Moken) as their learning language
- The home screen hero image updates dynamically based on the user's chosen language — both learner and elder variants, one per country
- Country flag metadata added to each language option (`LEARNING_LANGUAGE_METADATA`)
- 20 background images bundled via Vite `import.meta.glob`

### AI Coach Improvements

- ChatGPT proxy added as primary provider with Gemini as fallback (previously Gemini-only)
- Conversation threads are **persisted across sessions** — the coach remembers prior turns
- Authentication is now required for all coach requests
- Improved reliability: coaching sessions recover gracefully from provider timeouts

### Profile Onboarding

- New guided onboarding flow for first-time users: choose role (Learner / Elder), set display name, select learning language, and optionally upload an avatar
- Language preference is stored in `user_metadata` and immediately reflected in the hero background and app routing

---

## Demo & Resources

| Resource           | Link                                                           |
| ------------------ | -------------------------------------------------------------- |
| YouTube Submission | https://youtu.be/bcL9RvYezy4                                   |
| Figma Hi-Fi Design | https://www.figma.com/design/eUx2kJ3dssfOGgNwyiCoaz/HackWeeknd |
| Final Report       | [Report_Taleka_HACKWKND.pdf](Report_Taleka_HACKWKND.pdf)       |

---

## Why Semai?

Semai is an Aslian language spoken by approximately 30,000 people in Peninsular Malaysia. UNESCO classifies it as endangered — children are no longer acquiring it as their first language. It has limited digital presence and is excluded from commercial AI and NLP tooling. Taleka provides dedicated digital infrastructure for Semai preservation and learning, with a roadmap to expand to other ASEAN indigenous languages.

---

## Architecture

```mermaid
graph TD
    subgraph Client ["Mobile App (Ionic + React + Capacitor)"]
        UI["Pages & Components"]
        Store["Zustand Stores\n(auth, session)"]
        Lib["src/lib/\n(auth, translate, AI coach,\ngardenSync, elderStudio)"]
    end

    subgraph Supabase ["Supabase Cloud"]
        Auth["Auth\n(email/password, JWT)"]
        DB["Postgres DB\n(profiles, recordings,\nwords, progress, stories)"]
        Storage["Storage Buckets\n(recordings, avatars)"]
        FnCoach["Edge Fn: ai-coach\n(Gemini / ChatGPT proxy)"]
        FnTranslate["Edge Fn: ai-translate\n(Cerebras / SEA-LION)"]
        FnCover["Edge Fn: generate-story-cover\n(OpenRouter / GPT Image 2)"]
    end

    subgraph AIHelper ["ai-helper (local proxy, port 8787)"]
        OmniASR["OmniASR\n(Hugging Face)\n4-language ensemble STT"]
        Scorer["Dictionary-first\nscoring & merge"]
        Lexicon["Runtime lexicon\n(semaiLexicon + Webonary\n+ Supabase words)"]
    end

    UI --> Store
    UI --> Lib
    Lib --> Auth
    Lib --> DB
    Lib --> Storage
    Lib --> FnCoach
    Lib --> FnTranslate
    Lib --> FnCover
    Lib --> AIHelper
    AIHelper --> OmniASR
    AIHelper --> Scorer
    Scorer --> Lexicon
    Lexicon --> DB
```

### Data Flow: Elder Recording → Story

```
Elder records audio
  → ai-helper receives audio
  → OmniASR runs in 4 languages in parallel
  → Dictionary scorer picks & merges best candidate
  → Draft transcription stored in recordings table
  → Elder reviews & verifies transcription
  → is_verified = true, verified_transcription set
  → Elder clicks "Publish as Story"
  → generate-story-cover edge function called
      → fetches description + verified_transcription for context
      → calls GPT Image 2 to generate cover + background
  → cover_url, bg_url, is_published set on recording
  → Story appears in StoryPage for all learners
```

---

## Features

### Elder Studio

Voice recording and transcription for community elders. One-tap recording with waveform visualization. Recordings are transcribed using a multi-language OmniASR ensemble, then dictionary-scored and corrected. Elders review transcriptions and verify them against the Semai lexicon, which continuously expands the dictionary.

### Publish as Story

Verified recordings can be published as illustrated stories. The app generates a 2:3 portrait cover image and a full-screen background image using the recording's text as the visual prompt. Published stories are immediately visible to all learners.

### Language Garden

Spaced-repetition vocabulary learning. Words sourced from the verified Semai dictionary, organized by category. Progress tracked in Supabase (`progress` table, `mastery_level > 0` = learned). Leveling system: Seed → Sprout (≥1 word) → Sapling (≥125) → Tree (≥300).

### Stories

Folk tales and stories contributed by community elders, now dynamically fetched from Supabase. Each story is broken into scenes by paragraph. Scene images, cover art, and backgrounds are AI-generated. Reading progress tracked locally and synced.

### AI Coach (Tavi)

Conversational Semai tutor. Uses a deterministic rule layer (greetings, translation requests, known words) before hitting the LLM, so verified Semai is never invented by the model. Providers: ChatGPT proxy (primary) → Gemini (fallback). Sessions persist across app restarts.

### Translation

Bidirectional Semai ↔ Malay ↔ English. Priority chain: exact glossary match → exact sentence example → LLM with glossary constraints → word-by-word fallback. The LLM is the last resort, not the first.

### Learning Games

- **VocabMaster** — swipe-based flashcard practice (10 cards/round, right = known, left = review)
- **WordleGame** — daily 6-attempt Semai word guess
- **QuizGame** — multi-category comprehension quiz

### Sound Archive

Searchable library of all recorded Semai audio. Browse by category, search by keyword, play at variable speed.

### Profile & Progress

XP = `wordsLearned × 4`. Weekly leaderboard, avatar upload, role-based navigation (Learners get 5 tabs, Elders get 3).

---

## Tech Stack

| Layer       | Technology                                         |
| ----------- | -------------------------------------------------- |
| Frontend    | React 18, Ionic 8, Capacitor 6, Vite, TailwindCSS  |
| State       | Zustand                                            |
| Backend     | Supabase (Postgres, Auth, Storage, Edge Functions) |
| STT         | OmniASR via Hugging Face (4-language ensemble)     |
| AI Coach    | ChatGPT proxy / Gemini (google-generativeai)       |
| Translation | Cerebras (primary), SEA-LION (optional)            |
| Image Gen   | OpenRouter / GPT Image 2 (story covers)            |
| Testing     | Vitest + Testing Library                           |
| CI          | GitHub Actions (lint, typecheck, test)             |

---

## Project Structure

```
.
├── ai-helper/                 # Local OmniASR transcription proxy (Node.js, port 8787)
│   ├── server.js              # HTTP server — STT ensemble, scoring, lexicon cache
│   └── semaiLexicon.js        # Curated Semai term list
├── assets/
│   ├── flags/                 # Country flag SVGs (one per ASEAN indigenous language)
│   └── landing/background/    # Hero images — {country}-{learner|elder}.png (20 total)
├── supabase/
│   ├── migrations/            # Postgres schema migrations
│   └── functions/
│       ├── ai-coach/          # Conversational Semai tutor
│       ├── ai-translate/      # Semai ↔ Malay ↔ English translation
│       ├── generate-story-cover/ # AI cover + background image generation
│       ├── seed-words/        # Initial dictionary seed
│       └── _shared/           # Bundled Semai corpus (glossary + sentence examples)
└── src/
    ├── components/ui/         # Reusable UI (AppButton, AppSkeleton, …)
    ├── lib/                   # Core logic (auth, supabase, AI, storage, learningLanguages, …)
    ├── navigation/            # AppRouter — auth gates, role-based tab routing
    ├── pages/                 # All page components + per-page CSS
    ├── stores/                # Zustand (authStore)
    ├── types/                 # TypeScript types (Supabase DB schema)
    └── utils/                 # Validation, auth errors, profile progress
```

---

## Setup

### Prerequisites

- Node.js 22+
- A Supabase project (free tier works)
- (Optional) Hugging Face account for OmniASR transcription

### 1. Clone & install

```bash
git clone https://github.com/pablonification/HACKWKND-2026.git
cd HACKWKND-2026
npm install
```

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env
```

| Variable                          | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `VITE_SUPABASE_URL`               | Your Supabase project URL                                  |
| `VITE_SUPABASE_ANON_KEY`          | Supabase anon/public key                                   |
| `SUPABASE_SERVICE_ROLE_KEY`       | Service role key (used by ai-helper proxy)                 |
| `VITE_PASSWORD_RESET_REDIRECT_TO` | Redirect URL after password reset                          |
| `VITE_AI_BASE_URL`                | Transcription proxy URL (default: `http://localhost:8787`) |

### 3. Run database migrations

```bash
npx supabase db push
```

### 4. Deploy edge functions

```bash
npx supabase functions deploy ai-coach
npx supabase functions deploy ai-translate
npx supabase functions deploy generate-story-cover
npx supabase functions deploy seed-words
```

Set required secrets:

```bash
# AI Coach
supabase secrets set GOOGLE_AI_STUDIO_API_KEY=your_key
supabase secrets set AI_COACH_GEMINI_MODEL=gemini-3.1-flash-lite-preview

# Translation (Cerebras)
supabase secrets set CEREBRAS_API_KEY=your_key

# Story cover generation (OpenRouter)
supabase secrets set OPENROUTER_API_KEY=your_key
```

### 5. Start the frontend

```bash
npm run dev
# → http://localhost:5173
```

### 6. Start the transcription proxy (Elder Studio)

Required for voice recording and transcription in Elder Studio:

```bash
npm run ai-helper:dev
# → http://localhost:8787
```

### 7. Build for mobile

```bash
# iOS (requires macOS + Xcode)
npm run cap:ios

# Android
npm run cap:android
```

---

## AI Coach — Advanced Configuration

The `ai-coach` edge function supports a Claude Agent SDK gateway as the primary provider for demos:

```bash
# Edge function secrets
supabase secrets set AI_COACH_PROVIDER_ORDER=claude-agent,gemini
supabase secrets set AI_COACH_CLAUDE_AGENT_BASE_URL=https://your-gateway.example.com/v1
supabase secrets set AI_COACH_CLAUDE_AGENT_API_KEY=your_key
supabase secrets set AI_COACH_CLAUDE_AGENT_MODEL=sonnet
```

Run the local gateway (requires a Claude Code–authenticated machine):

```bash
TALEKA_CLAUDE_AGENT_KEY=your_key npm run demo:claude-agent-gateway
```

The gateway exposes `/v1/models` and `/v1/chat/completions` and must be tunnelled to a public HTTPS URL (e.g. ngrok) for Supabase to reach it.

Optional tuning knobs:

```bash
supabase secrets set AI_COACH_DIRECT_MAX_OUTPUT_TOKENS=220
supabase secrets set AI_COACH_PEDAGOGY_MAX_OUTPUT_TOKENS=150
supabase secrets set AI_COACH_TIMEOUT_MS=12000
supabase secrets set AI_COACH_PROVIDER_RETRY_COUNT=1
```

---

## Development

```bash
npm run dev              # Vite dev server (port 5173)
npm run ai-helper:dev    # Transcription proxy (port 8787)
npm run typecheck        # TypeScript check (no emit)
npm run lint             # ESLint (zero warnings)
npm run lint:fix         # ESLint with auto-fix
npm run format           # Prettier
npm run test             # Vitest watch mode
npm run test:run         # Vitest single run
npm run check            # Full quality gate (lint + format + typecheck + test)
npm run precommit        # Pre-commit gate (runs automatically via Husky)
```

All changes to `main` go through a PR. Greptile AI reviews every PR; minimum confidence score: 4/5.

---

## License

MIT — see [LICENSE](LICENSE) for details.
