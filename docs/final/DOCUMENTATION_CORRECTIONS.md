# Documentation Corrections Summary

**Date:** March 3, 2026  
**Files Updated:** 
- `docs/final/TUYANG_TASK_BREAKDOWN.md` (v1.1 → v1.2)
- `docs/final/TUYANG.md` (updated AI services section)

---

## 🔴 Critical Issue Discovered

**Nano Banana was incorrectly assigned as TTS provider** — this is technically impossible.

**Reality:**
- **Nano Banana** = Google's IMAGE GENERATION model (Gemini 3.1 Flash Image architecture)
- **Coqui TTS** = Open-source TEXT-TO-SPEECH (actual audio generation)

These are completely different AI modalities.

---

## ✅ Corrections Made

### 1. TUYANG_TASK_BREAKDOWN.md (v1.2)

| Section | Before (v1.1) | After (v1.2) |
|---------|--------------|--------------|
| **3.3 AI Services Table** | TTS: Google Nano Banana ❌ | TTS: Coqui TTS ✅ |
| **Day 2-3 Tasks** | AI Helper - Nano Banana stub (TTS) | AI Helper - Coqui TTS stub ✅ |
| **6.2 API Contracts** | `// Nano Banana - TTS` | `// Coqui TTS - Text-to-Speech` ✅ |
| **8.4 AI Helper Tasks** | Nano Banana TTS integration | Coqui TTS integration ✅ |
| **8.4 Acceptance** | "Nano Banana generates audio" | "Coqui TTS generates audio" ✅ |
| **Story Archive Tasks** | Nano Banana Image Gen | Nano Banana Image Gen (Story Archive only) ✅ |
| **Version** | v1.1 | **v1.2** |

**Added New Section 14: AI Services Correction Notes**
- Explains why Nano Banana ≠ TTS
- Documents correct provider assignments
- Provides reasoning for Coqui TTS selection

---

### 2. TUYANG.md

| Section | Before | After |
|---------|--------|-------|
| **6.6 AI Helper** | Coqui TTS (already correct) ✅ | No change needed |
| **6.7 Story Archive** | Image Gen: Stable Diffusion / DALL-E 3 | Image Gen: **Google Nano Banana** ✅ |
| **AI Components** | Missing Nano Banana docs | **Added Nano Banana section** with specs ✅ |
| **AI/ML Stack Table** | Missing Image Generation row | **Added: Image Generation - Google Nano Banana** ✅ |
| **AI Usage by Module** | Missing Story Archive AI | **Added: Story Archive - Whisper + Nano Banana** ✅ |
| **References** | 20 references | **21 references** (added Nano Banana) ✅ |

---

## 📋 Corrected AI Service Stack

| Service | Provider | Purpose | Used By |
|---------|----------|---------|---------|
| **ASR (Speech-to-Text)** | OpenAI Whisper API | Audio transcription | Elder Studio, Story Archive |
| **Translation** | SEA-LION (HuggingFace) | Semai ↔ Malay ↔ English | Elder Studio, Language Garden, Diaspora Bridge |
| **TTS (Text-to-Speech)** | **Coqui TTS** | Pronunciation generation | Language Garden |
| **Image Generation** | **Google Nano Banana** | Story illustrations | Story Archive ONLY |
| **Sentence Generation** | SEA-LION fine-tuned | Example sentences | Language Garden |
| **Semantic Search** | sentence-transformers + Vector DB | Natural language search | Sound Archive |

---

## 🎯 Key Takeaways

### Why Coqui TTS?
1. **Actual TTS technology** — generates audio from text
2. **Open-source** — can be self-hosted for offline scenarios
3. **Fine-tunable** — can train on low-resource languages like Semai
4. **Production-ready** — battle-tested in language preservation projects

### Why Nano Banana for Images?
1. **Google's latest** — Released Feb 2026 (Gemini 3.1 Flash Image)
2. **High resolution** — Supports 512px to 4K output
3. **Character consistency** — Critical for story illustration continuity
4. **Cultural styles** — Can generate traditional/watercolor/children's book styles
5. **Fast** — Sub-second generation for demo purposes

### What Changed in Practice?
- **AI Helper module** now implements **Coqui TTS** for pronunciation
- **Story Archive module** uses **Nano Banana** ONLY for image generation
- **No module uses Nano Banana for TTS** (because that's impossible)

---

## 🚨 Impact on Implementation

### Dev B (AI Developer) - Updated Tasks:

**Day 2-3: AI Helper**
- ✅ Whisper API integration (transcription)
- ✅ SEA-LION integration (translation)
- ✅ **Coqui TTS integration** (pronunciation) ← CORRECTED
- ⚠️ Nano Banana Image Gen → **Move to Story Archive (Day 6-8)**

**Day 6-8: Story Archive**
- ✅ Story selection + structuring
- ✅ **Nano Banana Image Gen** (story illustrations) ← Correct scope
- ✅ Flipbook UI + bilingual mode

---

## 📝 Additional Notes

### Timeline Feasibility (from background verification)
- **Original plan**: 10-day timeline with all 7 modules
- **Hackathon reality**: 2-3 day sprint (per TUYANG.md Section 11)
- **Recommendation**: Focus on P0 modules only:
  - Elder Studio (recording)
  - Sound Archive (browse + playback)
  - Language Garden (core learning)
  - AI Helper (Whisper transcription only)

### Priority Adjustments
- **Elder Profiles**: Upgrade from P1 → **P0** (core demo flow)
- **AI Transcription**: P1 (nice-to-have for MVP)
- **Story Archive**: P2 (skip if time-constrained)
- **Diaspora Bridge**: P2 (skip if time-constrained)

---

## ✅ Verification

Both documents now have **consistent AI service assignments**:
- ✅ TTS = Coqui TTS (both docs)
- ✅ Image Gen = Nano Banana (both docs)
- ✅ Whisper = Transcription (both docs)
- ✅ SEA-LION = Translation (both docs)

**Next Steps:**
1. Implement AI Helper with **Coqui TTS** (not Nano Banana)
2. Implement Story Archive with **Nano Banana Image Gen**
3. Keep references updated as implementation progresses

---

**Document Status:** ✅ Corrected and Consistent  
**Version:** TASK_BREAKDOWN v1.2, TUYANG.md updated  
**Date:** March 3, 2026
