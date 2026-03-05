# TUYANG: Task Breakdown Document

**Project:** Indigenous Language Preservation Ecosystem  
**Hackathon:** BorNEO HackWknd 2026  
**Duration:** 10 Days  
**Team:** 2 Full-Stack Developers  

---

## 1. Overview

### 1.1 Sprint Goals

| Goal | Target |
|------|--------|
| **Working MVP** | All 7 modules functional |
| **AI Integration** | Whisper, SEA-LION, Nano Banana |
| **Offline Capable** | Basic local storage + sync |
| **Demo-Ready** | Polished UI, video recording |

### 1.2 Module Priority Matrix

| Priority | Module | Owner | Days | Dependencies |
|----------|--------|-------|------|--------------|
| P0 | Elder Studio | Dev A | 2-3 | Auth, Storage |
| P0 | Sound Archive | Dev A | 2 | Elder Studio |
| P0 | AI Helper | Dev B | 2-3 | None |
| P0 | Language Garden | Dev B | 3-4 | AI Helper |
| P1 | Elder Profiles | Dev A | 1-2 | Elder Studio |
| P1 | Story Archive | Dev B | 2-3 | Sound Archive, AI |
| P1 | Diaspora Bridge | Both | 2 | Profiles, Sound |
| P2 | Admin Panel | SKIP | - | Use Supabase Dashboard |

### 1.3 Success Metrics

- [ ] Users can record audio offline → sync to cloud
- [ ] Browse and search 50+ sample words
- [ ] AI transcription works within 30 seconds
- [ ] Language Garden progression system functional
- [ ] Story Archive generates illustrated books
- [ ] Diaspora Bridge allows content requests
- [ ] Demo video recorded

---

## 2. Team Allocation

### 2.1 Dev A: Mobile-First Developer

| Module | Responsibilities |
|--------|-----------------|
| **Elder Studio** | Recording UI, local storage, sync, tagging |
| **Sound Archive** | Browse, search, playlists, playback |
| **Elder Profiles** | Profile display, follow system, stats |
| **Diaspora Bridge** | Mobile UI, request form, community board |

### 2.2 Dev B: Backend + AI Developer

| Module | Responsibilities |
|--------|-----------------|
| **AI Helper** | Whisper, SEA-LION, Nano Banana integrations |
| **Language Garden** | RPG progression, lessons, mini-games, AI chat |
| **Story Archive** | Story processing, illustration generation, flipbook |
| **Diaspora Bridge** | Backend APIs, request fulfillment, storage |

### 2.3 Shared Components

| Component | Owners |
|-----------|--------|
| Supabase Schema | Both |
| Authentication | Both |
| Navigation | Both |
| Shared UI Components | Both |
| Offline Sync | Both |
| Testing | Both |

---

## 3. Technical Stack

### 3.1 Frontend

| Component | Technology |
|-----------|------------|
| Framework | React Native (Expo) |
| Language | TypeScript |
| State | Zustand |
| Navigation | React Navigation |
| UI Library | NativeWind (Tailwind) |
| Animations | Reanimated |
| Local Storage | MMKV (react-native-mmkv) |

### 3.2 Backend

| Component | Technology |
|-----------|------------|
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Edge Functions | Supabase Functions |
| Audio Files | expo-file-system |

### 3.3 AI Services

| Service | Provider | Purpose |
|---------|----------|---------|
| ASR | OpenAI Whisper API | Audio transcription |
| Translation | SEA-LION (HuggingFace) | Semai ↔ Malay ↔ English |
| TTS | Coqui TTS | Pronunciation generation |
| Embeddings | sentence-transformers | Semantic search |

---

## 4. Offline Storage Strategy

### Data Types & Storage

| Data Type | Storage | Why |
|-----------|---------|-----|
| Settings, preferences | MMKV | Fast key-value |
| Recording metadata | MMKV | Simple objects |
| Word lists | MMKV | Read-heavy, simple |
| Learning progress | MMKV | Simple counters |
| Audio files | expo-file-system | Binary files |

### Sync Approach

**Simple queue-based sync (not WatermelonDB):**

```
1. Store pending changes in MMKV array
2. When online, process queue in order
3. Last-write-wins for conflicts (simple)
```

**Why not WatermelonDB?**
- Setup time: 1 hour (MMKV) vs 2-3 days (WatermelonDB)
- Complexity: Low (MMKV) vs High (WatermelonDB)
- Perfect for 10-day hackathon MVP

---

## 5. Sprint Timeline (Day-by-Day)

### Day 1: Foundation

**Goal:** Project scaffold + Auth + Supabase schema

| Task | Owner | Deliverable | Status |
|------|-------|-------------|--------|
| Initialize React Native (Expo) + TypeScript | Both | Repo created | ⬜ Not started |
| Set up Supabase project + schema | Both | Tables ready | ⬜ Not started |
| Implement Supabase Auth | Both | Sign up/login works | ⬜ Not started |
| Install NativeWind + MMKV | Dev A | Storage ready | ⬜ Not started |
| Create shared UI components | Dev A | Buttons, cards, inputs | ⬜ Not started |
| Set up navigation structure | Both | App flow defined | ⬜ Not started |

**Handoff:** Auth ready, shared components available

---

### Day 2-3: Core Recording + AI

**Goal:** Elder Studio functional + AI Helper base

| Task | Owner | Deliverable | Status |
|------|-------|-------------|--------|
| Elder Studio recording UI | Dev A | One-tap record works | ⬜ Not started |
| Local audio storage (MMKV + expo-file-system) | Dev A | Audio saves locally | ⬜ Not started |
| Supabase Storage upload | Dev A | Audio syncs to cloud | ⬜ Not started |
| AI Helper - Whisper integration | Dev B | Transcription works | ⬜ Not started |
| AI Helper - SEA-LION stub | Dev B | Translation endpoint ready | ⬜ Not started |
| AI Helper - Coqui TTS stub | Dev B | TTS endpoint ready | ⬜ Not started |
**Handoff:** Dev A can test audio → transcription flow

---

### Day 4-5: Content Consumption

**Goal:** Sound Archive + Language Garden base

| Task | Owner | Deliverable | Status |
|------|-------|-------------|--------|
| Sound Archive browse UI | Dev A | Category browsing works | ⬜ Not started |
| Sound Archive search | Dev A | Search returns results | ⬜ Not started |
| Sound Archive playback | Dev A | Audio plays with controls | ⬜ Not started |
| Language Garden home UI | Dev B | Dashboard displays | ⬜ Not started |
| Language Garden lessons | Dev B | Word cards + quiz | ⬜ Not started |
| Language Garden - AI chat | Dev B | Chat works (basic) | ⬜ Not started |

**Handoff:** Content flows from Archive → Garden

---

### Day 6-7: Gamification + Stories

**Goal:** Full Language Garden + Story Archive

| Task | Owner | Deliverable | Status |
|------|-------|-------------|--------|
| Language Garden progression | Dev B | XP + levels work | ⬜ Not started |
| Language Garden mini-game | Dev B | 1 game functional | ⬜ Not started |
| Language Garden streaks | Dev B | Daily streaks track | ⬜ Not started |
| Elder Profiles display | Dev A | Profile shows recordings | ⬜ Not started |
| Follow system | Dev A | Follow/unfollow works | ⬜ Not started |
| Story Archive - story selector | Dev B | Stories selectable | ⬜ Not started |
| Story Archive - Nano Banana image gen | Dev B | Illustrations generate | ⬜ Not started |
| Story Archive flipbook | Dev B | Pages flip correctly | ⬜ Not started |

**Note:** Nano Banana is ONLY for image generation (Story Archive). TTS uses Coqui.
**Handoff:** Full learning loop complete

---

### Day 8-9: Diaspora + Integration

**Goal:** Diaspora Bridge + E2E testing

| Task | Owner | Deliverable | Status |
|------|-------|-------------|--------|
| Diaspora Bridge - request form | Dev A | Requests submit | ⬜ Not started |
| Diaspora Bridge - community board | Dev A | Posts display | ⬜ Not started |
| Diaspora Bridge - fulfillment | Dev B | Requests answered | ⬜ Not started |
| Offline sync - basic | Both | Data syncs when online | ⬜ Not started |
| Integration testing | Both | E2E flows work | ⬜ Not started |
| Bug fixes | Both | Issues resolved | ⬜ Not started |

**Handoff:** All modules connected

---

### Day 10: Polish + Demo

**Goal:** Ship + Demo ready

| Task | Owner | Deliverable | Status |
|------|-------|-------------|--------|
| UI polish + animations | Both | Smooth transitions | ⬜ Not started |
| Edge cases handled | Both | No crashes | ⬜ Not started |
| Demo flow | Both | Walkthrough works | ⬜ Not started |
| Demo video recording | Both | Video captured | ⬜ Not started |
| Deployment | Both | Expo published | ⬜ Not started |

---

## 6. API Contracts

### 6.1 Supabase Schema

```sql
-- Users (extends Supabase auth.users)
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'learner', -- learner, elder, admin
  village TEXT,
  bio TEXT,
  created_at TIMESTAMP
)

-- Audio recordings
recordings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles,
  title TEXT,
  audio_url TEXT,
  duration INTEGER,
  type TEXT, -- word, story, song
  transcription TEXT,
  translation_ms TEXT,
  translation_en TEXT,
  tags TEXT[], -- forest, hunting, ceremony, etc
  elder_id UUID REFERENCES profiles,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMP
)

-- Words (vocabulary)
words (
  id UUID PRIMARY KEY,
  semai TEXT,
  meaning_ms TEXT,
  meaning_en TEXT,
  pronunciation_url TEXT,
  category TEXT,
  difficulty INTEGER DEFAULT 1,
  elder_id UUID REFERENCES profiles,
  created_at TIMESTAMP
)

-- Learning progress
progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles,
  word_id UUID REFERENCES words,
  status TEXT, -- learned, learning, new
  correct_count INTEGER DEFAULT 0,
  last_reviewed TIMESTAMP,
  created_at TIMESTAMP
)

-- User streaks
streaks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  created_at TIMESTAMP
)

-- Stories
stories (
  id UUID PRIMARY KEY,
  title TEXT,
  elder_id UUID REFERENCES profiles,
  audio_url TEXT,
  transcription TEXT,
  translation_ms TEXT,
  translation_en TEXT,
  scenes JSONB, -- structured scenes with characters, locations
  illustrations TEXT[], -- image URLs
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP
)

-- Diaspora requests
requests (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles,
  elder_id UUID REFERENCES profiles,
  title TEXT,
  description TEXT,
  status TEXT DEFAULT 'open', -- open, fulfilled, closed
  response_audio_url TEXT,
  created_at TIMESTAMP
)

-- Follows
follows (
  id UUID PRIMARY KEY,
  follower_id UUID REFERENCES profiles,
  following_id UUID REFERENCES profiles,
  created_at TIMESTAMP
)
```

### 6.2 AI Service Endpoints

```typescript
// Whisper - Transcription
POST /ai/transcribe
Input: { audio_url: string }
Output: { transcription: string }

// SEA-LION - Translation
POST /ai/translate
Input: { text: string, from: 'semai'|'ms'|'en', to: 'semai'|'ms'|'en' }
Output: { translated_text: string }

// Coqui TTS - Text-to-Speech
POST /ai/tts
Input: { text: string, voice_settings?: object }
Output: { audio_url: string }

// Nano Banana - Image Generation
POST /ai/generate-image
Input: { prompt: string, style: 'traditional'|'watercolor'|'children' }
Output: { image_url: string }

// Sentence Generation
POST /ai/generate-sentence
Input: { word: string, meaning: string }
Output: { sentences: string[] }
```

### 6.3 Local Storage Schema (MMKV)

```typescript
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV({ id: 'tuyang-storage' });

// Keys
const STORAGE_KEYS = {
  RECORDINGS: 'recordings',        // Recording[]
  WORDS: 'words',                  // Word[]
  PROGRESS: 'progress',            // Progress[]
  PROFILE: 'profile',              // Profile
  DOWNLOADED_AUDIO: 'downloaded',   // string[] (urls)
  PENDING_SYNC: 'pending-sync',    // Recording[]
  SETTINGS: 'settings',           // Settings
  STREAK: 'streak',               // Streak data
};

// Helper functions
const getRecordings = () => storage.getString(STORAGE_KEYS.RECORDINGS);
const setRecordings = (data: Recording[]) => storage.set(STORAGE_KEYS.RECORDINGS, JSON.stringify(data));
const addPendingSync = (recording: Recording) => {
  const pending = JSON.parse(storage.getString(STORAGE_KEYS.PENDING_SYNC) || '[]');
  pending.push(recording);
  storage.set(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(pending));
};
```

---

## 7. Dependency Graph

### 7.1 Critical Path

```
Day 1: Auth → Day 2: Recording → Day 3: AI → Day 4-5: Garden → Day 6-7: Stories → Day 8-9: Integration
```

### 7.2 Handoff Points

| Day | Dev A Gives | Dev B Receives |
|-----|-------------|----------------|
| 1 | - | Supabase schema |
| 2 | - | Audio files in storage |
| 3 | Transcription results | - |
| 4 | Archive browse | - |
| 5 | Audio playback | AI chat ready |
| 6 | Elder profiles | Stories ready |
| 7 | - | Illustrated stories |
| 8 | Request UI | Request handling |
| 9 | Full app | Full app |

### 7.3 Integration Checkpoints

| Checkpoint | Day | Success Criteria |
|------------|-----|------------------|
| Auth | 1 | Sign up/login works |
| Recording + Upload | 2 | Audio appears in Supabase |
| AI Transcription | 3 | Transcription displays |
| Archive Browse | 4 | Words display and play |
| Garden Progress | 6 | XP syncs to profile |
| Story Generation | 7 | Images generate |
| E2E Flow | 9 | Record → Transcribe → Learn → Progress |

---

## 8. Module Task Cards

### 8.1 Elder Studio (Dev A)

**Days:** 2-3  
**Dependencies:** Auth (Day 1), Supabase Storage (Day 1)

#### Tasks

- [ ] Recording screen with large record button
- [ ] Audio capture (expo-av)
- [ ] Recording type selection (word/story/song)
- [ ] Local save to MMKV before sync
- [ ] Background upload to Supabase Storage
- [ ] Recording list with recent items
- [ ] Recording detail/edit screen
- [ ] Cultural tagging UI (topic selection)
- [ ] Translation input fields (optional)

#### API Contract

```typescript
// Local (MMKV)
saveRecording(recording: Recording): Promise<void>
getLocalRecordings(): Promise<Recording[]>

// Remote
POST /storage/audio - Upload audio file
POST /recordings - Save metadata
GET /recordings?user_id={id} - Get user recordings
```

#### Acceptance Criteria

- [ ] Tap record → audio captured
- [ ] Go offline → recording saved locally (MMKV)
- [ ] Go online → syncs to Supabase
- [ ] Transcription appears within 30s (when online)
- [ ] Tags and translations saved

---

### 8.2 Sound Archive (Dev A)

**Days:** 4-5  
**Dependencies:** Elder Studio (Day 2-3)

#### Tasks

- [ ] Browse by category screen
- [ ] Browse by elder screen
- [ ] Search bar with results
- [ ] Audio player with controls (play/pause, seek)
- [ ] Playback speed control (0.5x, 0.75x, 1x)
- [ ] Loop mode toggle
- [ ] Download for offline button (expo-file-system)
- [ ] Playlist creation
- [ ] Add to favorites

#### API Contract

```typescript
GET /recordings - List all (with filters)
GET /recordings?category={cat} - Filter by category
GET /recordings?elder_id={id} - Filter by elder
GET /words - List vocabulary
POST /recordings/{id}/download - Mark as downloaded
```

#### Acceptance Criteria

- [ ] Browse shows all recordings
- [ ] Search returns relevant results
- [ ] Audio plays with controls
- [ ] Speed control works
- [ ] Offline downloads work

---

### 8.3 Elder Profiles (Dev A)

**Days:** 6-7 (parallel with other tasks)  
**Dependencies:** Sound Archive (Day 4-5)

#### Tasks

- [ ] Elder profile screen
- [ ] Photo, name, village, age, specialty
- [ ] Statistics display (recordings, followers)
- [ ] Quote/bio section
- [ ] Recording portfolio list
- [ ] Learning sets display
- [ ] Follow/unfollow button
- [ ] Follower count updates

#### API Contract

```typescript
GET /profiles/{id} - Get profile
GET /profiles/{id}/recordings - Get elder's recordings
GET /profiles/{id}/followers - Get followers
POST /follows - Follow elder
DELETE /follows/{id} - Unfollow elder
```

#### Acceptance Criteria

- [ ] Profile displays all info
- [ ] Follow button works
- [ ] Follower count updates
- [ ] Recordings list displays

---

### 8.4 AI Helper (Dev B)

**Days:** 2-3  
**Dependencies:** None (foundation)

#### Tasks

- [ ] Whisper API integration (transcription)
- [ ] SEA-LION API integration (translation)
- [ ] Coqui TTS integration
- [ ] Nano Banana Image Gen integration (Story Archive only)
- [ ] Sentence generation helper
- [ ] Error handling + retry logic
- [ ] Offline fallback messages

#### API Contract

```typescript
// All exposed as Supabase Edge Functions
transcribe(audioUrl: string): Promise<string>
translate(text: string, from: Lang, to: Lang): Promise<string>
tts(text: string): Promise<string>
generateImage(prompt: string, style: string): Promise<string>  // Story Archive only
generateSentences(word: string): Promise<string[]>
```

#### Acceptance Criteria

- [ ] Whisper returns transcription
- [ ] SEA-LION translates correctly
- [ ] Coqui TTS generates audio
- [ ] Nano Banana generates images (Story Archive)
- [ ] Errors show user-friendly messages

---

### 8.5 Language Garden (Dev B)

**Days:** 4-7  
**Dependencies:** AI Helper (Day 2-3), Words data (Day 4)

#### Tasks

- [ ] Home dashboard with progress
- [ ] Word cards with pronunciation
- [ ] Quiz/flashcard mode
- [ ] Spaced repetition algorithm
- [ ] XP system + levels (Seed → Sprout → Sapling → Tree → Forest)
- [ ] Streak tracking (stored in MMKV)
- [ ] Achievement badges
- [ ] AI conversation chat
- [ ] Progress sync to profile
- [ ] Mini-game (traditional house building)
- [ ] Statistics dashboard

#### API Contract

```typescript
GET /words - Get all words
GET /words?difficulty={n} - Filter by level
POST /progress - Save progress
GET /progress?user_id={id} - Get user progress
POST /streaks - Update streak
GET /garden/stats - Get garden statistics
```

#### Acceptance Criteria

- [ ] Words display with audio
- [ ] Quiz mode works
- [ ] XP increments on correct answers
- [ ] Level progression works
- [ ] Streak tracks daily activity
- [ ] AI chat responds
- [ ] Mini-game playable

---

### 8.6 Story Archive (Dev B)

**Days:** 6-8  
**Dependencies:** Sound Archive (Day 4-5), AI Helper (Day 2-3)

#### Tasks

- [ ] Story selection screen
- [ ] Story metadata display
- [ ] Scene structuring (AI)
- [ ] Illustration generation (Nano Banana Image Gen)
- [ ] Style selection (traditional/watercolor/children)
- [ ] Bilingual mode (Semai + MS/EN)
- [ ] Flipbook reader UI
- [ ] Page navigation
- [ ] Audio playback (elder reading)
- [ ] Read-along highlight
- [ ] Save to library
- [ ] Export option

#### API Contract

```typescript
GET /stories - List stories
GET /stories/{id} - Get story with scenes
POST /stories/{id}/illustrate - Generate images
POST /stories - Save new story
GET /stories/{id}/audio - Get audio playback
```

#### Acceptance Criteria

- [ ] Stories list displays
- [ ] Scenes structured correctly
- [ ] Illustrations generate per scene
- [ ] Bilingual toggle works
- [ ] Flipbook pages turn
- [ ] Audio plays with text

---

### 8.7 Diaspora Bridge (Shared)

**Days:** 8-9  
**Dependencies:** Elder Profiles (Day 6-7), Sound Archive (Day 4-5)

#### Dev A Tasks (Mobile UI)

- [ ] Request recording form
- [ ] Community board list
- [ ] Request status display
- [ ] Notification badges
- [ ] Virtual homestay video player
- [ ] Language exchange UI

#### Dev B Tasks (Backend)

- [ ] Request submission API
- [ ] Request listing API
- [ ] Request fulfillment API
- [ ] Community posts API
- [ ] Video upload handling

#### API Contract

```typescript
POST /requests - Submit request
GET /requests - List requests (with filters)
PUT /requests/{id} - Update request
POST /requests/{id}/respond - Elder responds
GET /posts - Community posts
POST /posts - Create post
```

#### Acceptance Criteria

- [ ] Submit request → appears in list
- [ ] Elder sees requests
- [ ] Community posts display
- [ ] Video playback works

---

## 9. Acceptance Criteria (Summary)

### Must Have (MVP)

- [ ] User can sign up/login
- [ ] Record audio (offline → sync online)
- [ ] Browse recordings by category
- [ ] Search recordings
- [ ] Play audio with controls
- [ ] View elder profiles
- [ ] Follow/unfollow elders
- [ ] Learn words (flashcards)
- [ ] Track progress (XP/levels)
- [ ] AI transcription works
- [ ] AI translation works
- [ ] AI TTS works
- [ ] Story reader works
- [ ] Diaspora requests work

### Should Have

- [ ] Streak tracking
- [ ] Achievements
- [ ] AI chat in Garden
- [ ] Story illustrations
- [ ] Offline downloads
- [ ] Playlist creation

### Nice to Have

- [ ] Mini-games
- [ ] Video recording
- [ ] Advanced analytics
- [ ] Community board

---

## 10. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI API rate limits | Medium | High | Cache responses, show fallback |
| Offline sync conflicts | Medium | Medium | Last-write-wins with timestamps |
| Supabase cold starts | Low | Medium | Pre-warm with background fetch |
| Image gen costs | High | Low | Use low-res for demo, limit generation |
| Integration delays | Medium | High | Daily sync meetings, early testing |
| Device testing issues | Low | Medium | Test on both iOS/Android from Day 2 |

---

## 11. Daily Standup Questions

Each day, answer:

1. **What did I build yesterday?**
2. **What will I build today?**
3. **Any blockers?** (If yes, sync immediately)

---

## 12. Definition of Done

A task is complete when:

- [ ] Code written and committed
- [ ] No TypeScript errors
- [ ] Tested on device (iOS or Android)
- [ ] Integrated with dependent modules
- [ ] Added to demo flow (if visible)

---

## 13. Demo Flow

For the final presentation:

```
1. Sign up as Elder
   → Record "rumah" (house)
   → See AI transcription + translation

2. Sign up as Learner
   → Browse Sound Archive
   → Play "rumah" recording
   → Follow Elder

3. Language Garden
   → See progress dashboard
   → Learn "rumah" in quiz
   → Earn XP, level up

4. Story Archive
   → Select folk tale
   → See AI illustrations
   → Read bilingual flipbook

5. Diaspora Bridge
   → Request new word
   → See community requests

6. Offline Demo
   → Turn off wifi
   → Record new word
   → Show local storage (MMKV)
```

---

**Document Version:** 1.3 (Updated: Backend implementation complete)
**Created:** March 2026  
**Hackathon:** BorNEO HackWknd 2026
833#TL|
## 14. AI Services Correction Notes

**Important**: Nano Banana is Google's IMAGE GENERATION model only (Gemini 3.1 Flash Image architecture).

| Service | Correct Provider | Incorrect Assignment (v1.1) |
|---------|----------------|----------------------------|
| TTS | Coqui TTS | Nano Banana ❌ |
| Image Generation | Nano Banana | Nano Banana ✅ |

**Why Coqui TTS?**
- Coqui is open-source text-to-speech (actual audio generation)
- Can be fine-tuned for low-resource languages like Semai
- Self-hostable for offline scenarios

**Why Nano Banana for images?**
- Google's latest image generation model (Feb 2026)
- Supports 512px-4K resolution
- Character consistency across scenes
- Perfect for Story Archive illustrations


## 15. Backend Implementation Summary (March 2026)

### Completed

- **Database**: 9 migrations with 8 tables, RLS, triggers
- **Storage**: 2 buckets (audio, images) with RLS policies  
- **Edge Functions**: 5 AI endpoints deployed
- **Database Functions**: Spaced repetition, streak, XP/level, analytics
- **Triggers**: Auto-streak, auto-follower count
- **Offline Sync**: Queue management

### Files Created
- supabase/migrations/ (9 files)
- supabase/functions/ai-* (5 functions)
- src/lib/supabaseStorage.ts
- docs/backend/API.md
- .env.example (updated)