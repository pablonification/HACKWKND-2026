# Taleka

<img width="1247" height="697" alt="image" src="https://github.com/user-attachments/assets/74dd9377-6c60-4e1e-85bd-c296d937f9f4" />

## Demo & Resources

- [YouTube Video Submission](https://youtu.be/bcL9RvYezy4): [https://youtu.be/bcL9RvYezy4](https://youtu.be/bcL9RvYezy4)
- [Figma Hi-Fi Design](https://www.figma.com/design/eUx2kJ3dssfOGgNwyiCoaz/HackWeeknd?node-id=0-1&t=2P25Uv7cXfUSoD7c-1): [https://www.figma.com/design/eUx2kJ3dssfOGgNwyiCoaz/HackWeeknd?node-id=0-1&t=2P25Uv7cXfUSoD7c-1](https://www.figma.com/design/eUx2kJ3dssfOGgNwyiCoaz/HackWeeknd?node-id=0-1&t=2P25Uv7cXfUSoD7c-1)
- [Final Report](Report_Taleka_HACKWKND.pdf): [Report_Taleka_HACKWKND.pdf](Report_Taleka_HACKWKND.pdf)

Taleka is a mobile language learning and cultural preservation platform designed to help protect endangered indigenous languages. Built for the BorNEO HackWknd 2026 (Theme: The Role of AI in ASEAN Social Impact), the app currently focuses on Semai, an indigenous language spoken by the Semai people of Peninsular Malaysia.

The platform serves two user types: learners who want to learn Semai, and elders who preserve and share their language through voice recordings. By combining community voices, interactive learning tools, and AI-powered features, Taleka creates an engaging environment for language preservation and acquisition.

## Why Semai?

Semai is an Aslian language (Austronesian family) spoken by approximately 30,000 people in Peninsular Malaysia. It is classified as endangered by UNESCO, as children are no longer acquiring it as their first language. The Semai language has limited digital presence and is largely excluded from commercial AI and NLP tools. Taleka aims to bridge this gap by providing a dedicated digital infrastructure for Semai language preservation and learning.

## Features

### Elder Studio

A voice recording and transcription tool that enables community elders to archive their spoken language. The interface is designed for elderly users with minimal technical experience, featuring one-tap recording and simple controls. Recordings are processed through speech-to-text (Whisper) to create searchable, learnable content for the community.

Elders can review and verify their own transcriptions against existing dictionary entries. New or alternative meanings are flagged and merged into the lexicon after a brief self-verification, continuously expanding and improving the dictionary.

### Language Garden

Interactive vocabulary learning with spaced repetition. Users build their Semai word bank through curated word lists organized by category, with definitions in English and Malay. The vocabulary is sourced from a verified Semai dictionary, enabling learners to cross-check vocabulary and sentences with authoritative meanings.

### Stories

A collection of folk tales and stories in Semai, contributed by community elders. Learners can read stories with translations, track reading progress, and revisit completed stories. Stories are organized with metadata including elder contributor, theme tags, and reading duration.

### AI Coach

A personal AI tutor powered by a ChatGPT/Codex proxy with Gemini fallback that provides conversational practice in Semai. The coach uses the project's glossary and sentence examples to give grounded, contextually accurate responses. It supports multiple interaction modes including vocabulary help, sentence construction, translation assistance, and free conversation.

### Translation

Bidirectional translation between Semai, English, and Malay. The translation system uses the project's dictionary and sentence memory for accurate, context-aware results. Translation requests are handled through Supabase Edge Functions.

### Learning Games

- **VocabMaster**: Swipe-based vocabulary practice with card animations. Users swipe right to mark words as known, left to review again. Each round presents 10 cards with definitions in English and Malay.
- **WordleGame**: Daily Semai word guessing game where players have 6 attempts to guess a random word from the vocabulary.
- **QuizGame**: Interactive quizzes to test language comprehension across multiple categories.

### Sound Archive

A searchable library of all recorded Semai audio. Users can browse recordings by category, search for specific words, and play audio with variable playback speed for learning purposes.

### Profile & Progress

User profiles track learning progress, display current level, earned achievements, and weekly leaderboard rankings. The leveling system rewards consistent engagement with the app. Users can customize their profile with avatar, display name, and language preferences.

## Technical Stack

<img width="922" height="548" alt="image" src="https://github.com/user-attachments/assets/46c67a07-a8f7-45de-84df-983400641ee2" />

## Project Structure

```
.
├── LICENSE              # MIT License
├── README.md           # This file
├── ai-helper/          # OmniASR proxy for local transcription
├── docs/               # Planning and assessment documents
├── supabase/           # Database migrations and edge functions
└── src/
    ├── components/ui/  # Reusable UI components
    ├── lib/            # Core utilities (auth, supabase, storage, AI)
    ├── pages/          # Page components
    ├── stores/         # Zustand state stores
    ├── types/          # TypeScript type definitions
    └── utils/          # Validation and helper utilities
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Running AI Helper (Local Transcription)

Elder Studio transcription uses `VITE_AI_BASE_URL` and calls `POST /ai/transcribe`.

Run the proxy locally:

```bash
npm run ai-helper:dev
```

Then set frontend env:

```bash
VITE_AI_BASE_URL=http://localhost:8787
```

### Building for Mobile

```bash
# iOS
npm run cap:ios

# Android
npm run cap:android
```

### Running Tests

```bash
npm test        # Watch mode
npm run test:run  # Single run
```

### Code Quality

```bash
npm run check   # Full check (lint, format, typecheck, test)
```

## AI Configuration

### AI Coach (Supabase Edge Function)

The personal AI coach uses the `ai-coach` edge function and reuses the project glossary and sentence-memory assets for grounded Semai responses. For the competition demo, it can use a protected local Claude Agent SDK gateway as the primary provider with Gemini as fallback.

Set these edge-function secrets for coach generation:

```bash
AI_COACH_PROVIDER_ORDER=claude-agent,gemini
AI_COACH_CLAUDE_AGENT_BASE_URL=https://your-claude-agent-gateway.example.com/v1
AI_COACH_CLAUDE_AGENT_API_KEY=your_taleka_claude_agent_gateway_key
AI_COACH_CLAUDE_AGENT_MODEL=sonnet
GOOGLE_AI_STUDIO_API_KEY=your_google_ai_studio_key
AI_COACH_GEMINI_MODEL=gemini-3.1-flash-lite-preview
```

Optional overrides:

```bash
AI_COACH_DIRECT_MAX_OUTPUT_TOKENS=220
AI_COACH_PEDAGOGY_MAX_OUTPUT_TOKENS=150
AI_COACH_INTENT_MAX_OUTPUT_TOKENS=96
GOOGLE_AI_STUDIO_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_COACH_TIMEOUT_MS=12000
AI_COACH_PROVIDER_RETRY_COUNT=1
AI_COACH_PROVIDER_RETRY_DELAY_MS=900
```

Local Claude Agent SDK gateway:

```bash
TALEKA_CLAUDE_AGENT_KEY=your_taleka_claude_agent_gateway_key \
TALEKA_CLAUDE_AGENT_RETRY_COUNT=2 \
TALEKA_CLAUDE_AGENT_RETRY_DELAY_MS=900 \
npm run demo:claude-agent-gateway
```

The gateway forwards only `/v1/models` and `/v1/chat/completions` into the Claude Agent SDK. It must run on a machine authenticated with Claude Code or configured with supported Claude credentials, then be exposed to Supabase through a protected HTTPS URL for demos.

## License

MIT License — see [LICENSE](LICENSE) for details.
