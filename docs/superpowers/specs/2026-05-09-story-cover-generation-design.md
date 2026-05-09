# Story Cover Generation — Design Spec

**Date:** 2026-05-09
**Status:** Approved

## Overview

Elders can generate AI cover and background images for a verified recording before publishing it as a story. Images are generated via OpenRouter's GPT Image 2 model and stored in the existing `stories` Supabase Storage bucket. The generated URLs are persisted on the `recordings` row alongside a new `is_published` flag.

---

## Pipeline

```
Record audio
  → Save to Archive (draft)
    → OmniASR transcribes (recordings.transcription populated)
      → Elder verifies transcript in Archive view
        → [Publish as Story] action unlocked
          → Step 1: Generate Visuals (cover + bg)
            → Elder previews, optionally regenerates
              → Step 2: Confirm & Publish
                → recordings row updated with cover_url, bg_url, is_published=true
                  → StoryPage reads from recordings table
```

---

## 1. Database Migration

File: `supabase/migrations/20260509100000_add_story_publish_fields_to_recordings.sql`

Add three columns to `public.recordings`:

| Column | Type | Default |
|---|---|---|
| `cover_url` | `TEXT` | `NULL` |
| `bg_url` | `TEXT` | `NULL` |
| `is_published` | `BOOLEAN` | `false` |

No RLS changes needed — existing policies already allow uploaders to update their own unverified recordings, and admins to update any.

---

## 2. Supabase Edge Function: `generate-story-cover`

**File:** `supabase/functions/generate-story-cover/index.ts`

**Auth:** Requires `Authorization: Bearer <user-jwt>` header. The edge function validates the JWT via the Supabase admin client and rejects unauthenticated requests.

**Input (JSON body):**
```json
{
  "recordingId": "uuid",
  "title": "string",
  "description": "string"
}
```

**Processing:**
1. Validate inputs (title required; description optional, used in prompt if present).
2. Build two prompts:
   - **Cover:** `"An illustrated children's book cover for a Semai Malaysian folklore story titled '{title}'. {description}. Traditional rainforest setting, warm earthy tones, vibrant and detailed illustration style."`
   - **Background:** `"A wide panoramic illustrated scene from the Semai Malaysian folklore story '{title}'. Lush jungle landscape, soft watercolor atmosphere, cinematic background painting."`
3. Call OpenRouter image API **in parallel** for both prompts:
   - Endpoint: `https://openrouter.ai/api/v1/images/generations`
   - Model: `openai/gpt-image-2`
   - `response_format: "b64_json"`, `size: "1024x1024"`, `n: 1`
4. Decode each base64 response → `Uint8Array`.
5. Upload to `stories` bucket:
   - Cover path: `{recordingId}-cover.png`
   - Background path: `{recordingId}-bg.png`
   - Using Supabase Storage admin client (`SUPABASE_SERVICE_ROLE_KEY`).
   - If the Elder regenerates, these paths are overwritten — no orphan files accumulate.
6. Return public URLs:
```json
{ "coverUrl": "https://...", "bgUrl": "https://..." }
```

**Secrets required** (set via `supabase secrets set`):
- `OPENROUTER_API_KEY`
- `SUPABASE_URL` (auto-available in edge functions)
- `SUPABASE_SERVICE_ROLE_KEY` (auto-available in edge functions)

**Error handling:**
- OpenRouter call fails → `500` with `{ error: "Image generation failed" }`
- Storage upload fails → `500` with `{ error: "Storage upload failed" }`
- Missing title → `400` with `{ error: "title is required" }`

---

## 3. Client Lib: `src/lib/storyImages.ts`

Thin typed wrapper following the pattern of `src/lib/translate.ts` and `src/lib/aiCoach.ts`.

```ts
export type GeneratedStoryVisuals = {
  coverUrl: string;
  bgUrl: string;
};

export async function generateStoryVisuals(
  recordingId: string,
  title: string,
  description: string,
): Promise<GeneratedStoryVisuals>
```

- Calls `supabase.functions.invoke('generate-story-cover', { body: { recordingId, title, description } })`.
- Throws a typed error if the function returns an error body.

Also exports:
```ts
export async function publishRecordingAsStory(
  recordingId: string,
  coverUrl: string,
  bgUrl: string,
): Promise<void>
```
- Updates `recordings` row: `{ cover_url, bg_url, is_published: true }`.
- Uses the Supabase client directly (no edge function needed — standard RLS update).

---

## 4. UI: Archive Publish Flow

**Location:** Archive view (`/home/archive`), on a recording card that has `is_verified = true` and `is_published = false`.

**Entry point:** A "Publish as Story" button on qualifying recording cards.

**Step 1 — Generate Visuals (modal or inline panel):**
- Shows recording title + truncated transcription excerpt.
- "Generate Cover & Background" button → calls `generateStoryVisuals()`.
- Loading state: spinner + "Generating visuals…" label (generation can take 10–20 s).
- Success state: two side-by-side image thumbnails (cover left, background right) with labels.
- A "Regenerate" button to call again if the Elder isn't satisfied.
- A "Continue →" button to proceed to Step 2.

**Step 2 — Confirm & Publish:**
- Summary card: title, cover thumbnail, "Publish this story?" confirmation text.
- "Publish Story" button → calls `publishRecordingAsStory()`, then dismisses the flow and shows a success toast.
- "Cancel" link discards the generated URLs without updating the recording row. Images already uploaded to storage remain as orphan files — acceptable for now, cleanup is out of scope.

**States to handle:**
- Generation error → inline error message with retry button.
- Publish error → toast error, user can retry.
- Already published → "Publish as Story" button hidden; a "Published" badge shown instead.

---

## 5. `.env.example` Update

Add:
```
# =========================
# OpenRouter (Image Generation)
# =========================
OPENROUTER_API_KEY=your-openrouter-api-key
```

Note: This key is used **only** by the edge function (server-side). It is not exposed to the frontend.

---

## Out of Scope

- StoryPage reading from Supabase (still reads `storyData.ts` — separate task).
- Moderator/admin approval before publishing.
- Storing the image prompt used (can be added later to the `stories` table).
- Image regeneration limit / rate limiting.
