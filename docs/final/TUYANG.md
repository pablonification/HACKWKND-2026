# TALEKA: Indigenous Language Preservation Ecosystem

**Document Type:** Solution Design & Implementation Blueprint  
**Case Study:** Case Study 2 — Indigenous Language Preservation  
**Hackathon:** BorNEO HackWknd 2026  
**Theme:** The Role of AI in ASEAN Social Impact  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Language Selection: Semai](#language-selection-semai)
4. [Solution Overview](#solution-overview)
5. [Core Philosophy](#core-philosophy)
   - [6.5 Diaspora Bridge](#65-diaspora-bridge)
   - [6.6 AI Helper](#66-ai-helper)
   - [6.7 Story Archive](#67-story-archive-interactive-folklore-book)
   - [6.8 Admin Panel](#68-admin-panel)
7. [AI Integration Architecture](#ai-integration-architecture)
8. [Technical Stack](#technical-stack)
9. [Offline-First Design](#offline-first-design)
10. [Evaluation Criteria Alignment](#evaluation-criteria-alignment)
11. [Implementation Timeline](#implementation-timeline)
12. [Risk Analysis & Mitigations](#risk-analysis--mitigations)
13. [Future Roadmap](#future-roadmap)
14. [References & Sources](#references--sources)

---

## Executive Summary

**TALEKA** is a comprehensive mobile ecosystem for preserving and revitalizing the Semai language — an endangered indigenous language spoken by the Orang Asli of peninsular Malaysia.

The solution addresses the critical challenge outlined in Case Study 2: Indigenous Language Preservation. While commercial AI and NLP tools remain optimized for high-resource languages like English and Chinese, hundreds of indigenous languages in ASEAN face extinction without digital presence.

TALEKA distinguishes itself through:

- **Community-driven content**: Elders contribute recordings, youth learn
- **Offline-first architecture**: Works in rural areas with limited connectivity
- **Cultural immersion**: Language learned through context, not flashcards
- **Elder Profiles**: Emotional connection between learners and language keepers
- **Multiple AI modalities**: Speech-to-text, text-to-speech, translation, sentence generation

The solution is designed for the **Technical Track** submission, requiring a working prototype with code on GitHub.

---

## Problem Statement

### Global Context

- **3,000+ languages** are at risk of extinction worldwide (UNESCO)
- Approximately **40% of world's 6,700 languages** risk disappearance by 2100
- A language dies every **two weeks** on average

### ASEAN Specific Challenges

- **Indonesia** leads the world with **425 endangered languages**
- **Malaysia** has **111 indigenous languages**, with **89 classified as endangered**
- **Philippines** has **48 endangered languages**
- Commercial AI/NLP tools exclude low-resource and indigenous languages

### Semai Context

- **~30,000 speakers** in peninsular Malaysia
- Classified as **endangered** — children are no longer acquiring it as first language
- Part of the **Aslian language family** (Austronesian)
- Well-documented by linguistic researchers (MPI Archive, SIL International)
- Existing resources are fragmented and not easily accessible to community

### The Core Problem

> Indigenous languages lack digital infrastructure. Youth abandon heritage languages for dominant national languages. AI systems exclude these languages. Without intervention, these languages will vanish within a generation.

---

## Language Selection: Semai

### Why Semai?

| Criteria | Semai | Other Options |
|----------|-------|---------------|
| **Documentation Level** | High (MPI, SIL papers) | Varies |
| **Speaker Count** | ~30,000 | Some have <1,000 |
| **Dataset Availability** | Moderate | Limited |
| **Cultural Relevance** | Orang Asli — Malaysia's indigenous peoples | Various |
| **Accessibility** | Peninsular Malaysia (accessible for testing) | Some remote |

### Semai Language Profile

- **Family**: Austronesian > Aslian > Senoic > Semai
- **Speakers**: ~30,000 (endangered)
- **Location**: Peninsular Malaysia (Pahang, Negeri Sembilan, Perak, Kelantan)
- **Script**: Latin script (no native writing system)
- **Related languages**: Semelai, Jahai, Temiar, Kensiu (all Aslian)

### Available Resources

1. **MyAsli Project** (Universiti Utara Malaysia)
   - Multimedia recordings of Jahai, Temiar, Kensiu
   - Can be adapted for Semai

2. **MPI Archive** (Max Planck Institute)
   - Field recordings, lexicons, narratives
   - Semelai corpus available as reference

3. **SIL International**
   - Linguistic papers on Semai dialects
   - Phonological and grammatical documentation

4. **SEACrowd Dataset**
   - Consolidates SEA language resources
   - Includes some Aslian language data

---

## Solution Overview

### The TALEKA Ecosystem

```
┌─────────────────────────────────────────────────────────────┐
│                         TALEKA                               │
│            Language Preservation Through Connection         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │   ELDER     │  │   LANGUAGE  │  │    SOUND    │       │
│   │   STUDIO    │→ │   GARDEN   │← │   ARCHIVE   │       │
│   │  (Record)   │  │  (Learn)   │  │  (Search)   │       │
│   └─────────────┘  └─────────────┘  └─────────────┘       │
│          │                │                 │               │
│          └───────────────┼─────────────────┘               │
│                          ↓                                  │
│                  ┌─────────────┐                            │
│                  │   AI HELPER  │                            │
│                  │  (Connects   │                            │
│                  │   Everything) │                           │
│                  └─────────────┘                            │
│                                                             │
│   ┌─────────────────────────────────────────────────┐       │
│   │           DIASPORA BRIDGE (Web App)            │       │
│   │      (Connect urban youth ↔ rural elders)      │       │
│   └─────────────────────────────────────────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Core Value Proposition

| Traditional Language Apps | TALEKA |
|--------------------------|--------|
| Vocabulary drills | Cultural immersion |
| Individual learning | Community ecosystem |
| Requires internet | **Offline-first** |
| One-way content | **Bidirectional** (elders contribute) |
| Generic gamification | Culturally-relevant RPG |
| Language only | **Language + Stories + Culture** |

---

## Core Philosophy

### "Language Lives Through People"

TALEKA is built on the principle that language is not just vocabulary — it's:

- **Connection to ancestors** — Language carries cultural memory
- **Place** — Words are tied to land, forest, rivers
- **Community** — Speaking connects people
- **Identity** — Language is who we are

### Design Principles

1. **Community First**: Elders are content creators, not just subjects
2. **Offline Essential**: Semai speakers live in rural areas without reliable internet
3. **Cultural Context**: Words learned through stories, ceremonies, daily life
4. **Emotional Connection**: Learners connect to specific elders, not abstract content
5. **Preservation + Revitalization**: Archive existing knowledge AND enable new learning

---

## Module Specifications

### 6.1 Elder Studio

**Purpose**: Enable elders to record and preserve their language knowledge

#### Description

A mobile-first recording interface designed for elderly users with minimal technical experience. Allows recording of words, phrases, stories, and songs with contextual metadata.

#### Features

| Feature | Description |
|---------|-------------|
| **Simple Recording** | One-tap record, one-tap save |
| **Word Recording** | Single word + pronunciation + meaning |
| **Story Recording** | Extended audio/video of oral stories |
| **Cultural Tagging** | Tag by topic: hunting, forest, ceremonies, food, kinship |
| **Video Support** | Optional video for visual storytelling |
| **Offline Storage** | Records save locally, sync when online |
| **AI Transcription** | Whisper-based transcription assistance |
| **Translation Help** | AI-assisted translation to Malay/English |

#### User Flow

```
1. Open Elder Studio → Tap "Record"
2. Select type: Word / Story / Song
3. Record audio/video
4. (Optional) Add translation/meaning
5. (Optional) Tag with cultural context
6. Save → Stored locally
7. When online → Syncs to cloud
```

#### UI Mockup

```
┌─────────────────────────────────────────┐
│        🏠 ELDER STUDIO                  │
│                                         │
│    ┌─────────────────────────────────┐ │
│    │                                 │ │
│    │         🎤 TAP TO RECORD        │ │
│    │                                 │ │
│    └─────────────────────────────────┘ │
│                                         │
│    Recent Recordings:                   │
│    ┌─────────────────────────────────┐ │
│    │ 🔊 "bobolian" - healer          │ │
│    │    2 hours ago                  │ │
│    ├─────────────────────────────────┤ │
│    │ 🔊 "rumah" - house              │ │
│    │    Yesterday                     │ │
│    └─────────────────────────────────┘ │
│                                         │
│    [+ Word]  [+ Story]  [+ Song]       │
│                                         │
└─────────────────────────────────────────┘
```

#### Technical Requirements

- Audio recording (AAC format)
- Video recording (MP4, compressed)
- @capacitor/preferences for metadata queue-based sync
- Background sync when online
- Whisper API integration (when online)

---

### 6.2 Language Garden

**Purpose**: Gamified language learning for youth

#### Description

An engaging RPG-style learning experience where users grow a virtual village by learning Semai words. Progress is tied to cultural context — learning isn't just memorization, it's understanding a way of life.

#### Features

| Feature | Description |
|---------|-------------|
| **RPG Progression** | Seed → Sprout → Sapling → Tree → Forest |
| **Village Building** | Earn "fruits" to build your virtual village |
| **Cultural Mini-games** | Build house, prepare food, attend ceremonies |
| **Contextual Learning** | Words learned with cultural background |
| **AI Conversation** | Practice with AI mentor |
| **Spaced Repetition** | Optimized retention algorithm |
| **Progress Tracking** | Track words learned, streaks, achievements |

#### Cultural Mini-Games

1. **Build a Traditional House**
   - Learn building terms: rumah (house), bubung (roof), tiang (post)
   - Understand when these structures are used

2. **Prepare Bobohiz** (Rice Wine)
   - Learn food vocabulary: rice, fermentation, serving
   - Understand ceremonial importance

3. **Forest Expedition**
   - Learn forest/animal terms: tree species, animals, hunting
   - Understand relationship with land

4. **Wedding Ceremony**
   - Learn kinship terms: parent, grandparent, in-laws
   - Understand social structure

#### Progression System

```
🌱 SEED (0-50 words)
   - Basic greetings
   - Numbers 1-10
   - Family terms

🌿 SPROUT (51-150 words)
   - Daily objects
   - Food and drink
   - Colors and shapes

🌳 SAPLING (151-300 words)
   - Animals and nature
   - Actions and verbs
   - Places and directions

🌲 TREE (301-500 words)
   - Complex sentences
   - Ceremonies and customs
   - Stories and proverbs

🌳 FOREST (501+ words)
   - Fluency achieved
   - Can understand basic conversations
   - Can participate in ceremonies
```

#### AI Integration

- **Conversation Practice**: Chat with AI in Semai
- **Sentence Generation**: Create examples from minimal data
- **Personalization**: Adjust difficulty based on progress
- **Pronunciation Feedback**: Compare user speech to elder recordings

#### Technical Requirements

- Game engine (Ionic React with CSS animations + Capacitor)
- Local progress storage
- SEA-LION API for conversation
- TTS for pronunciation playback

---

### 6.3 Sound Archive

**Purpose**: Searchable library of all recorded Semai audio

#### Description

A comprehensive audio library where users can browse, search, and listen to all recordings. Makes the community's collected knowledge accessible and discoverable.

#### Features

| Feature | Description |
|---------|-------------|
| **Browse by Category** | Topics, elders, villages, occasions |
| **Semantic Search** | AI-powered search: "show me forest stories" |
| **Playlists** | Curated collections: "Bedtime stories", "Ceremony songs" |
| **Slow Playback** | 0.5x, 0.75x speed for learning |
| **Loop Mode** | Repeat pronunciation for practice |
| **Contribute** | Users can add their own recordings |
| **Offline Access** | Download for offline listening |

#### Browse Categories

- **By Topic**: Forest, Hunting, Ceremonies, Food, Family, Daily Life
- **By Elder**: All recordings from specific elder
- **By Village**: Recordings from specific community
- **By Occasion**: Harvest festival, Wedding, Funeral, Storytelling

#### Technical Requirements

- Full-text search (Typesense)
- Audio streaming with caching
- Playlist management
- Download queue for offline

---

### 6.4 Elder Profiles

**Purpose**: Connect learners to the people behind the language

#### Description

Each elder has a profile showcasing their knowledge, specialty, and recordings. Learners can follow elders they're connected to, creating emotional investment in learning.

#### Features

| Feature | Description |
|---------|-------------|
| **Elder Bio** | Photo, name, age, village, specialty |
| **Recording Portfolio** | All words and stories they've recorded |
| **Follow System** | Follow elders to see their new content |
| **Learn from Elder** | Curated lesson sets from specific elder |
| **Community Stats** | How many learners follow, total recordings |

#### Profile Structure

```
┌─────────────────────────────────────────┐
│         TOK BALA                         │
│         (Elder Profile)                 │
│                                         │
│    📷 [Photo]                          │
│                                         │
│    📍 Village: Kg. Leban Rebah         │
│    🎂 Age: 78                          │
│    ⭐ Specialty: Forest spirits & stories│
│                                         │
│    [Follow]  [Start Learning]          │
│                                         │
│    ─────────────────────────            │
│    📊 Statistics:                      │
│    • Words recorded: 127               │
│    • Stories: 23                       │
│    • Learners following: 156            │
│                                         │
│    💬 "I want young people to know    │
│        the words our grandparents      │
│        gave us."                       │
│                                         │
│    📚 Learning Sets:                    │
│    • Forest Spirit Stories (12 words)  │
│    • Hunting Terms (23 words)          │
│    • Traditional Songs (8 songs)        │
│                                         │
└─────────────────────────────────────────┘
```

#### Why Elder Profiles Matter

1. **Emotional Connection**: Learning feels personal, not abstract
2. **Honors Individuals**: Elder knowledge is recognized, not anonymized
3. **Community Accountability**: Elders know learners are following
4. **Cultural Continuity**: Creates link between generations
5. **Motivation**: Learners want to "complete" an elder's collection

#### Technical Requirements

- User profiles with auth
- Follow system (many-to-many relationships)
- Content aggregation by elder
- Push notifications for new content

---

### 6.5 Diaspora Bridge

**Purpose**: Connect urban/diaspora youth with rural communities

#### Description

A web-based platform bridging the gap between urban youth (who may have lost connection to their heritage) and rural elders (who hold the language knowledge).

#### Features

| Feature | Description |
|---------|-------------|
| **Virtual Homestay** | Daily video diaries from village life |
| **Request Recordings** | Ask elders specific words/stories |
| **Language Exchange** | Urban youth teach digital skills, elders teach language |
| **Crowdfund Support** | Fund community language events |
| **Community Board** | Announcements, events, discussions |

#### User Flow (Urban Youth)

```
1. Sign up → Select heritage background
2. Browse villages and elders
3. Follow elder(s) of interest
4. Watch virtual homestay videos
5. Request specific recordings
6. Participate in language exchange
7. Contribute to community projects
```

#### User Flow (Rural Elder)

```
1. Sign up → Verify as community elder
2. Record daily life videos
3. Receive recording requests
4. Fulfill requests from diaspora
5. Join community discussions
6. Receive community support
```

#### Technical Requirements

- Web app (Next.js)
- Video hosting (Supabase Storage or Mux)
- Request/fulfill workflow
- Community messaging
- Payment integration for crowdfunding

## 6.6 AI Helper

**Purpose**: The brain that connects everything — AI services accessible across all modules

#### Description

AI Helper is not a separate module users interact with directly, but an underlying service layer that enhances every feature in TALEKA. It provides translation, speech, and intelligence capabilities.

#### Features

| Feature | Description |
|---------|-------------|
| **FR-7.1 AI Translation** | Translate Semai ↔ Malay, Semai ↔ English |
| **FR-7.2 Pronunciation Generator** | TTS for words without elder recordings |
| **FR-7.3 Sentence Generator** | Generate example sentences from learned vocabulary |
| **FR-7.4 Personalized Learning** | Analyze user performance, recommend content |
| **FR-7.5 Semantic Search** | Natural language search across content |

#### Technical Implementation

- SEA-LION API for translation
- Coqui TTS for pronunciation (fine-tuned for Semai)
- sentence-transformers for embeddings
- Pinecone/Milvus for vector search

---

## 6.7 Story Archive (Interactive Folklore Book)

**Purpose**: Transform elder recordings into interactive bilingual illustrated storybooks

#### Description

The Story Archive takes oral stories recorded by elders and transforms them into engaging digital books with AI-generated illustrations, bilingual text, and interactive features. This bridges the gap between oral tradition and digital engagement for young learners.

#### Features

##### FR-10.1 Story Selection

| Feature | Description |
|---------|-------------|
| **Source Selection** | Select from Elder Studio recordings or Sound Archive |
| **Story Metadata** | Display: title, elder name, summary, duration, theme |
| **Theme Tags** | spirits, animals, forest, myth, moral story |

##### FR-10.2 AI Story Structuring

After story is selected:

| Step | Description |
|------|-------------|
| **Transcription** | Get transcript from audio (Whisper) |
| **Text Cleaning** | Remove noise, normalize text |
| **Scene Division** | Split story into meaningful scenes |
| **Character ID** | Identify main characters |
| **Location & Culture** | Extract setting and cultural elements |

**Output Structure:**

```
Story: "The Crocodile and the Monkey"
├── Scene 1: Monkey lives in the forest
│   ├── Characters: Monkey, Mother
│   ├── Location: Forest, riverside
│   └── Vocabulary: tree, fruit, river
├── Scene 2: Crocodile approaches
│   ├── Characters: Crocodile
│   ├── Location: River
│   └── Vocabulary: crocodile, swim, dangerous
├── Scene 3: The escape
│   ├── Characters: Monkey, Crocodile
│   ├── Lesson: Cleverness over strength
│   └── Vocabulary: trick, laugh, run
└── Moral: Use your wits
```

##### FR-10.3 AI Illustration Generation

| Feature | Description |
|---------|-------------|
| **Per-Scene Illustration** | Generate image for each scene |
| **Style Options** | Traditional Semai patterns, Watercolor, Children book |
| **Cultural Accuracy** | Depict correct clothing, houses, forest |
| **Regeneration** | User can regenerate images |
| **Prompt Editing** | Simple prompt adjustments |

**Styles:**

- **Traditional**: Based on Semai patterns, earth tones, tribal art style
- **Watercolor**: Soft colors, dreamy, educational feel
- **Children's Book**: Bright colors, friendly characters, simple backgrounds

##### FR-10.4 Bilingual Story Mode

| Mode | Description |
|------|-------------|
| **Semai Only** | Original language with transliteration |
| **Semai + Malay** | Side-by-side translation |
| **Semai + English** | Side-by-side translation |

**Interactive Features:**

- Highlight learned vocabulary in text
- Tap any word for:
  - Audio pronunciation
  - Translation
  - Add to learning deck

##### FR-10.5 Interactive Folklore Book

**Output: Digital Flipbook**

| Feature | Description |
|---------|-------------|
| **Page Layout** | Illustration + text on each page |
| **Audio Playback** | Elder voice reading the story |
| **Read-Along Mode** | Words highlight as audio plays |
| **Navigation** | Scroll mode or flip animation |
| **Moral Section** | At end, summarize the lesson |

**User Actions:**

- Save to personal library
- Download as lightweight PDF
- Share link (if online)
- Send to children as bedtime story

##### FR-10.6 Story-Based Learning Integration

| Integration | Description |
|-------------|-------------|
| **Language Garden** | Quiz based on story vocabulary |
| **Vocabulary Extraction** | Auto-add words from stories |
| **Mini-Games** | Character-based games from stories |
| **Elder Profile** | Stories appear on elder's profile |
| **Statistics** | Track "stories turned into books" |

##### FR-10.7 Save & Share

| Feature | Description |
|---------|-------------|
| **Personal Library** | Save created books |
| **PDF Export** | Lightweight downloadable version |
| **Share Link** | Generate shareable URL (online) |
| **Bedtime Mode** | Send to children, auto-play with music |

##### FR-10.8 Cultural Integrity Safeguards

| Safeguard | Description |
|-----------|-------------|
| **Community Ownership** | Display: "This story belongs to [Elder/Community]" |
| **Elder Approval** | Require approval before public release |
| **Privacy Options** | Private (family only), Community, Public |
| **Disclaimer** | Note that stories represent community heritage |
| **Revocation** | Elder can request takedown |

#### User Flow

```
1. Select story from Archive
2. AI processes: transcription → structuring → scenes
3. Review structured story (edit if needed)
4. Generate illustrations (choose style)
5. Select language mode (Semai/Malay/English)
6. Preview flipbook
7. Save / Share / Export
```

#### Technical Requirements

| Component | Technology |
|-----------|------------|
| Text Processing | Whisper + NLP (spaCy) |
| Scene Segmentation | Custom ML model |
| Image Generation | Google Nano Banana (Gemini 3.1 Flash Image) |

---

## 6.8 Admin Panel

**Purpose**: Content management and analytics for community admins

#### Description

A web-based admin dashboard for managing content, users, and viewing analytics. Accessible by Community Admins and the core team.

#### Features

##### FR-9.1 Content Moderation

| Feature | Description |
|---------|-------------|
| **Pending Submissions** | View all new recordings awaiting review |
| **Approval/Rejection** | Approve or reject with reason |
| **Bulk Actions** | Mass approve/reject |
| **Metadata Edit** | Fix tags, titles, translations |
| **Content Removal** | Remove inappropriate content |
| **Elder Verification** | Verify elder accounts |

**Moderation Queue:**

```
┌─────────────────────────────────────────────┐
│  MODERATION QUEUE (12 pending)              │
├─────────────────────────────────────────────┤
│  ☐ "bobolian - healer"                     │
│     Elder: Tok Bala | Submitted: 2h ago   │
│     [Approve] [Reject] [Edit]              │
├─────────────────────────────────────────────┤
│  ☐ "rumah bubung - traditional house"      │
│     Elder: Makcik Min | Submitted: 5h ago  │
│     [Approve] [Reject] [Edit]              │
└─────────────────────────────────────────────┘
```

##### FR-9.2 Analytics Dashboard

| Metric | Description |
|--------|-------------|
| **Active Users** | DAU, MAU, new registrations |
| **Learning Metrics** | Most learned words, completion rates |
| **Elder Stats** | Most followed elders, top contributors |
| **Content Stats** | Total recordings, stories, books |
| **Retention** | Day 1, Day 7, Day 30 retention |
| **Engagement** | Sessions per user, time in app |

**Dashboard Preview:**

```
┌─────────────────────────────────────────────────┐
│  TALEKA ANALYTICS                               │
├─────────────────────────────────────────────────┤
│  📊 Overview                                    │
│  ────────────────────────────────────────────  │
│  Active Users: 1,247 (↑ 12%)                   │
│  Total Recordings: 3,891                       │
│  Words Learned: 45,230                         │
│  Stories Published: 127                         │
│                                                 │
│  📈 Top Words This Week                        │
│  ────────────────────────────────────────────  │
│  1. bobolian (healer) - 892                   │
│  2. rumah (house) - 756                       │
│  3. bobohiz (rice wine) - 623                 │
│                                                 │
│  👴 Top Elders                                 │
│  ────────────────────────────────────────────  │
│  1. Tok Bala - 156 followers                   │
│  2. Makcik Min - 98 followers                  │
│  3. Tok Long - 87 followers                    │
└─────────────────────────────────────────────────┘
```

##### Additional Admin Features

| Feature | Description |
|---------|-------------|
| **User Management** | View, suspend, promote users |
| **Role Management** | Assign: Admin, Moderator, Elder, Learner |
| **Broadcast** | Send notifications to all users |
| **Export Data** | CSV/JSON export for research |
| **Settings** | App configuration, feature flags |

#### Technical Requirements

| Component | Technology |
|-----------|------------|
| Framework | Next.js Admin Dashboard |
| Charts | Recharts / Chart.js |
| Tables | TanStack Table |
| Auth | Same as main app (Supabase) |
| Export | CSV generation |

---

## AI Integration Architecture

### Overview

TALEKA leverages multiple AI technologies to enhance every module:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI INTEGRATION LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Whisper   │  │  SEA-LION   │  │   Coqui     │       │
│  │   (ASR)     │  │ (Translate) │  │   (TTS)     │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Sentence    │  │  Semantic   │  │  Personal-  │       │
│  │ Generation  │  │   Search    │  │  ization    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AI Components

#### Speech-to-Text (ASR): Whisper

| Aspect | Details |
|--------|---------|
| **Model** | Whisper (openai/whisper) |
| **Use Case** | Transcribe elder recordings |
| **Deployment** | API (when online) / whisper.cpp (offline) |
| **Languages** | Multilingual including Malay |
| **Reference** | https://github.com/openai/whisper |

#### Translation: SEA-LION

| Aspect | Details |
|--------|---------|
| **Model** | SEA-LION v3.5 (Llama 3.1 based) |
| **Use Case** | Translate between Semai, Malay, English |
| **Languages** | 11 Southeast Asian languages |
| **Deployment** | HuggingFace inference API |
| **Reference** | https://sea-lion.ai/ |

#### Text-to-Speech (TTS): Coqui

| Aspect | Details |
|--------|---------|
| **Model** | Coqui TTS |
| **Use Case** | Generate pronunciation for words without recordings |
| **Deployment** | Local (Docker) or cloud |
| **Note** | May require fine-tuning for Semai |
| **Reference** | https://coqui.ai/ |

#### Image Generation: Google Nano Banana

| Aspect | Details |
|--------|---------|
| **Model** | Nano Banana 2 (Gemini 3.1 Flash Image) |
| **Use Case** | Generate story illustrations for Story Archive |
| **Deployment** | Google AI Studio / Vertex AI API |
| **Capabilities** | 512px-4K resolution, character consistency, cultural styles |
| **Reference** | https://blog.google/innovation-and-ai/products/nano-banana-2/ |

#### Sentence Generation: Fine-tuned LLM

| Aspect | Details |
|--------|---------|
| **Model** | SEA-LION fine-tuned on Semai corpus |
| **Use Case** | Generate example sentences from minimal data |
| **Training** | Few-shot learning with existing corpus |
| **Reference** | NüshuRescue methodology |

#### Semantic Search: Embeddings + Vector DB

| Aspect | Details |
|--------|---------|
| **Embeddings** | sentence-transformers (multilingual) |
| **Vector DB** | Pinecone or Milvus |
| **Use Case** | "Show me stories about crocodiles" |
| **Offline** | Can use local FAISS for offline |

### AI Usage by Module

| Module | AI Features |
|--------|------------|
| **Elder Studio** | Whisper transcription, SEA-LION translation |
| **Language Garden** | SEA-LION conversation, TTS pronunciation, personalization |
| **Sound Archive** | Semantic search, content tagging |
| **Elder Profiles** | Content aggregation, recommendation |
| **Story Archive** | Whisper transcription, Nano Banana image generation |
| **Diaspora Bridge** | Translation for communication |

---

## Technical Stack

### Mobile Application (Vite + Ionic React + Capacitor)

| Component | Technology |
|-----------|------------|
| Framework | Vite 5 + Ionic React 8 + Capacitor 8 |
| Language | TypeScript |
| State Management | Zustand ^5 |
| Navigation | React Router v6 (MemoryRouter) |
| UI Components | Ionic React 8 + Tailwind CSS (preflight disabled) |
| Animations | Ionic transitions + CSS animations |

### Backend

| Component | Technology |
|-----------|------------|
| Database | Supabase (PostgreSQL) |
| Authentication | Supabase Auth |
| Storage | Supabase Storage |
| Edge Functions | Supabase Functions |
| Real-time | Supabase Realtime |

### AI/ML

| Component | Technology |
|-----------|------------|
| ASR | Whisper API / whisper.cpp |
| Translation | SEA-LION (HuggingFace) |
| TTS | Coqui TTS |
| Image Generation | Google Nano Banana (Gemini 3.1 Flash Image) |
| Search | Typesense |
| Vector DB | Pinecone (cloud) / FAISS (offline) |
### Offline

| Component | Technology |
|-----------|------------|
| Local Storage | @capacitor/preferences (queue-based sync) |
| Sync | Supabase + local queue |
| Audio Caching | @capacitor/filesystem |

### DevOps

| Component | Technology |
|-----------|------------|
| CI/CD | GitHub Actions |
| Hosting | Vercel (web), Capacitor (mobile → TestFlight/Play Store) |
| Monitoring | Sentry |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (Vite + Ionic React + Capacitor)        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ Elder Studio│  │LanguageGarden│  │Sound Archive│        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │
│         └────────────────┼────────────────┘                │
│                          ↓                                  │
│                  ┌─────────────┐                            │
│                  │  @capacitor/ │                            │
│                  │  preferences │                            │
│                  └─────────────┘                            │
│                          │                                  │
│                    Sync ↓↑                                  │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │      SUPABASE           │
              │  ┌─────┐ ┌──────────┐  │
              │  │Auth │ │Database  │  │
              │  └─────┘ └──────────┘  │
              │  ┌──────────────────┐   │
              │  │     Storage      │   │
              │  └──────────────────┘   │
              └─────────────────────────┘
                           │
                           ↓
              ┌─────────────────────────┐
              │      AI SERVICES       │
              │  ┌─────┐ ┌─────┐ ┌───┐  │
              │  │Whisper│ │SEA- │ │TTS│  │
              │  │     │ │LION │ │   │  │
              │  └─────┘ └─────┘ └───┘  │
              └─────────────────────────┘
```

---

## Offline-First Design

### Why Offline-First?

Semai communities live in **rural areas** with:
- Limited or no internet connectivity
- Expensive data plans
- Unreliable network coverage

Traditional apps won't work. TALEKA is designed from ground up to **work without internet**.

### Offline Strategy

| Scenario | Solution |
|----------|----------|
| **Record in village** | Save to local SQLite |
| **Learn offline** | Pre-download lessons + audio |
| **Search offline** | Local index (FAISS) |
| **Sync when online** | Background sync when connected |

### Data Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     OFFLINE-FIRST SYNC                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   LOCAL (Phone)          →         CLOUD (Supabase)        │
│                                                             │
│   ┌─────────────┐                        ┌─────────────┐   │
│   │  Recorded   │                        │   All User  │   │
│   │  Audio      │   ──────────────────→  │   Content   │   │
│   │  (new)      │   Auto-sync when online│             │   │
│   └─────────────┘                        └─────────────┘   │
│                                                             │
│   ┌─────────────┐   Pull on open    ┌─────────────┐       │
│   │  Downloaded │  ← ─────────────── │   New       │       │
│   │  Lessons    │   or manual refresh│   Content   │       │
│   └─────────────┘                    └─────────────┘       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

- **@capacitor/preferences**: Local key-value storage with queue-based sync
- **@capacitor/filesystem**: Download and cache audio files
- **Background Tasks**: Sync when app is in background
- **Conflict Resolution**: Last-write-wins with timestamps

---

## Evaluation Criteria Alignment

### How TALEKA Meets BorNEO HackWknd 2026 Criteria

| Criteria | Weight | TALEKA Alignment |
|----------|--------|------------------|
| **Report** | 25% | Comprehensive problem analysis, SDG alignment, methodology |
| **AI Integration** | 10% | 4+ AI features: ASR, TTS, translation, sentence generation |
| **Innovation** | 15% | First offline-first ecosystem for Semai; Elder Profiles unique |
| **Functionality** | 15% | Complete 5-module working prototype |
| **Visual Design** | 15% | Culturally-inspired UI, accessibility, ASEAN inclusivity |
| **Pitching** | 10% | Clear narrative, emotional connection |
| **Market Potential** | 10% | Clear path: Orang Asli communities, researchers, cultural orgs |

### SDG Alignment

| SDG | TALEKA Contribution |
|-----|-------------------|
| **SDG 4: Quality Education** | Making language education accessible to all |
| **SDG 10: Reduced Inequalities** | Giving indigenous communities digital tools |
| **SDG 11: Sustainable Communities** | Preserving cultural heritage |
| **SDG 17: Partnerships** | Connecting communities, researchers, organizations |

---

## Implementation Timeline

### Hackathon Sprint (2-3 Days)

| Day | Focus | Deliverable |
|-----|-------|-------------|
| **Day 1** | Core Infrastructure | Vite + Ionic + Capacitor setup, Supabase, offline storage |
| **Day 1-2** | Elder Studio | Recording UI, local storage, basic playback |
| **Day 2** | Language Garden | Basic gamification, 50 sample words |
| **Day 2-3** | Sound Archive | Browse + search, sample content |
| **Day 3** | Elder Profiles | Profile UI, follow system |
| **Day 3** | Polish + Demo | UI refinements, video recording |

### MVP Features

| Priority | Feature |
|----------|---------|
| **P0** | Record audio (Elder Studio) |
| **P0** | Browse recordings (Sound Archive) |
| **P0** | Basic word learning (Language Garden) |
| **P0** | Elder Profiles display |
| **P1** | AI transcription |
| **P1** | Offline sync |
| **P1** | Gamification elements |
| **P2** | AI conversation |
| **P2** | Diaspora Bridge web app |

---

## Risk Analysis & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Limited Semai data** | High | Medium | Use MyAsli as seed data; focus on recording workflow |
| **AI not trained on Semai** | High | Medium | Few-shot learning; focus on transcription/translation |
| **Offline sync complexity** | Medium | High | Use WatermelonDB (battle-tested) |
| **Elder adoption** | Medium | High | Simple UI; work with community leaders |
| **Audio storage costs** | Medium | Low | Compress audio; Supabase generous free tier |

---

## Future Roadmap

### Post-Hackathon

| Phase | Timeline | Features |
|-------|----------|----------|
| **Phase 1** | Month 1-3 | More languages (Jahai, Temiar), community launch |
| **Phase 2** | Month 3-6 | Diaspora Bridge, AI conversation improvement |
| **Phase 3** | Month 6-12 | Partnership with universities, research papers |

### Scaling Opportunities

1. **More Languages**: Expand to other Aslian languages (Jahai, Temiar, Kensiu)
2. **Government Partnership**: Work with Malaysian heritage agencies
3. **Research Collaboration**: Partner with linguistics departments
4. **UNESCO Recognition**: Apply for endangered language preservation initiatives
5. **Open Source**: Release core framework for other communities

---

## References & Sources

### Academic Papers

1. **NüshuRescue: Reviving the Endangered Nüshu Language with AI** (COLING 2025)
   - https://aclanthology.org/2025.coling-main.468/
   - Methodology for training LLMs on minimal data

2. **FormosanBench: Benchmarking Low-Resource Austronesian Languages** (2025)
   - https://arxiv.org/pdf/2506.21563
   - Framework for evaluating LLMs on Atayal, Amis, Paiwan

3. **SEACrowd: A Multilingual Multimodal Data Hub** (EMNLP 2024)
   - https://aclanthology.org/2024.emnlp-main.296.pdf
   - Dataset consolidation for 1000+ SEA languages

4. **AI for Language and Cultural Preservation** (Bowdoin Science Journal, 2025)
   - https://students.bowdoin.edu/bowdoin-science-journal/csci-tech/ai-for-language-and-cultural-preservation/
   - Principles for community-led AI language projects

5. **Harnessing AI for Endangered Indigenous Languages** (arXiv, 2024)
   - https://arxiv.org/html/2407.12620v2
   - Technologies and experiences from IBM Research

### Projects & Platforms

6. **First Voices**
   - https://www.firstvoices.com/
   - Indigenous language archiving platform (Canada)

7. **Āhau: Indigenous Community Platform**
   - https://www.ahau.io/
   - Māori-designed platform for cultural preservation
   - Features genealogy, archiving, community database

8. **MyAsli Project**
   - https://myasli.com.my/
   - Malaysian Orang Asli multimedia language repository

9. **Living Dictionaries**
   - https://livingdictionaries.app/
   - Open-source dictionary building tool

10. **Woolaroo (Google Arts & Culture)**
    - https://blog.google/company-news/outreach-and-initiatives/arts-culture/explore-the-world-around-you-in-30-endangered-languages-with-google-ai/
    - Photo translation for endangered languages

### Models & Tools

11. **SEA-LION**
    - https://sea-lion.ai/
    - Southeast Asian Languages in One Network
    - Open multilingual AI for 11 SEA languages

12. **SEACrowd Data Hub**
    - https://seacrowd.github.io/
    - Standardized datasets for SEA languages

13. **Whisper (OpenAI)**
    - https://github.com/openai/whisper
    - Multilingual speech recognition

14. **Coqui TTS**
    - https://coqui.ai/
    - Open source text-to-speech

15. **Google Nano Banana 2**
    - https://blog.google/innovation-and-ai/products/nano-banana-2/
    - AI image generation model (Gemini 3.1 Flash Image)
    - 512px-4K resolution, character consistency

### Case Studies

16. **Nyiyaparli Widi Game** (2025)
    - https://www.abc.net.au/news/2025-11-19/aboriginal-language-game-wins-global-award/
    - Award-winning game for endangered Aboriginal language

17. **KadazanlinGO!** (2025)
    - https://rsisinternational.org/journals/ijriss/view/revitalising-the-adazan-language-through-adazanlin-go
    - Gamified Kadazan language learning app

18. **Cherokee Language Dictionary App** (2025)
    - https://anadisgoi.com/index.php/culture-stories/cherokee-nation-launches-new-cherokee-language-dictionary-app-with-advanced-learning-tools
    - Partnership between Cherokee Nation and Kiwa Digital

### Statistics & Reports

19. **UNESCO Atlas of the World's Languages in Danger**
    - https://en.unesco.org/languages-atlas
    - Global language endangerment data

20. **SEAMEO Education Reports**
    - https://www.seameo.org/
    - Southeast Asian education context

21. **Ethnologue: Malaysia Languages**
    - https://www.ethnologue.com/country/MY/
    - 111 indigenous languages in Malaysia, 89 endangered

---

## Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **ASLian** | Language family of peninsular Malaysia indigenous languages |
| **Orang Asli** | "First People" of peninsular Malaysia |
| **Endangered Language** | Language with few speakers, no longer transmitted to children |
| **Low-Resource Language** | Language with limited digital data for AI training |
| **Offline-First** | Application designed to work without internet connectivity |
| **Data Sovereignty** | Community's right to own and control their data |

### B. Semai Sample Vocabulary

| Semai | Meaning | Category |
|-------|---------|----------|
| bobolian | traditional healer | Person |
| rumah | house | Building |
| bobohiz | rice wine | Food |
| tong | forest spirit | Supernatural |
| semai | we/us/our | Pronoun |

### C. Tech Stack Quick Reference

| Layer | Technology | Version |
|-------|------------|---------|
| Mobile | Vite 5 + Ionic React 8 + Capacitor 8 | Latest |
| Backend | Supabase | Latest |
| AI ASR | Whisper | v3 |
| AI Translate | SEA-LION | v3.5 |
| Local DB | @capacitor/preferences | Latest |
| Search | Typesense | Latest |

---

**Document Version:** 1.0  
**Last Updated:** March 2026  
**Authors:** [Team Name]  
**Hackathon:** BorNEO HackWknd 2026  
