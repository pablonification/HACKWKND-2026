# Story Cover Generation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow Elders to generate AI cover and background images for a verified recording and publish it as a story — images generated via OpenRouter GPT Image 2, stored in the existing `stories` Supabase Storage bucket.

**Architecture:** A new `generate-story-cover` Supabase Edge Function wraps the OpenRouter image API and handles storage uploads server-side. The frontend lib `storyImages.ts` calls the function and exposes `publishRecordingAsStory` which writes the URLs + `is_published=true` directly to the `recordings` table. The UI lives in `SoundArchiveTab.tsx` as an overlay flow, reusing the existing `studio-flow-screen` pattern from `ElderStudioTab`.

**Tech Stack:** Deno (Edge Function), OpenRouter image API (`openai/gpt-image-2`), Supabase Storage REST API, Supabase JS client, React, Vitest + vi.mock

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `supabase/migrations/20260509100000_add_story_publish_fields_to_recordings.sql` | Adds `cover_url`, `bg_url`, `is_published` to `recordings` |
| Modify | `.env.example` | Documents `OPENROUTER_API_KEY` |
| Modify | `src/types/database.ts` | Adds 3 fields to `recordings` Row / Insert / Update |
| Modify | `src/lib/elderStudio.ts` | Adds 3 fields to `StudioRecording` type and `fromRemoteRow` |
| Create | `src/lib/storyImages.ts` | `generateStoryVisuals`, `publishRecordingAsStory` |
| Create | `src/lib/storyImages.test.ts` | Unit tests for both lib functions |
| Create | `supabase/functions/generate-story-cover/index.ts` | Deno edge function |
| Modify | `src/pages/SoundArchiveTab.tsx` | Publish flow state + UI |
| Create | `src/pages/SoundArchiveTab.css` | Styles for publish flow thumbnails |

---

## Task 1: Database migration + .env.example

**Files:**
- Create: `supabase/migrations/20260509100000_add_story_publish_fields_to_recordings.sql`
- Modify: `.env.example`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260509100000_add_story_publish_fields_to_recordings.sql
alter table public.recordings
  add column if not exists cover_url text,
  add column if not exists bg_url text,
  add column if not exists is_published boolean not null default false;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset`

Expected output ends with: `Finished supabase db reset.`

- [ ] **Step 3: Document the env var in .env.example**

In `.env.example`, add after the `ELEVENLABS` block:

```
# =========================
# OpenRouter (Image Generation)
# =========================
OPENROUTER_API_KEY=your-openrouter-api-key
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509100000_add_story_publish_fields_to_recordings.sql .env.example
git commit -m "feat: add cover_url, bg_url, is_published to recordings table"
```

---

## Task 2: Update TypeScript database types

**Files:**
- Modify: `src/types/database.ts` — `recordings` Row (line 59), Insert (line 86), Update (line 113)

- [ ] **Step 1: Add fields to Row type**

In `src/types/database.ts`, the `recordings.Row` block ends at `updated_at: string | null;` (around line 84). Add three lines before that closing `};`:

```ts
          cover_url: string | null;
          bg_url: string | null;
          is_published: boolean;
```

Result — the end of `Row` should look like:
```ts
          is_verified: boolean;
          verified_at: string | null;
          verified_by: string | null;
          cover_url: string | null;
          bg_url: string | null;
          is_published: boolean;
          created_at: string;
          updated_at: string | null;
        };
```

- [ ] **Step 2: Add fields to Insert type**

In the `Insert` block (ends around line 111), add before the closing `};`:

```ts
          cover_url?: string | null;
          bg_url?: string | null;
          is_published?: boolean;
```

- [ ] **Step 3: Add fields to Update type**

In the `Update` block (ends around line 136), add before the closing `};`:

```ts
          cover_url?: string | null;
          bg_url?: string | null;
          is_published?: boolean;
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts
git commit -m "feat: add cover_url, bg_url, is_published to recordings database types"
```

---

## Task 3: Extend StudioRecording type and fromRemoteRow

**Files:**
- Modify: `src/lib/elderStudio.ts`

- [ ] **Step 1: Add three fields to StudioRecording type**

In `src/lib/elderStudio.ts`, the `StudioRecording` type definition ends at `updatedAt: string;` (around line 82). Add three fields before `updatedAt`:

```ts
  coverUrl: string | null;
  bgUrl: string | null;
  isPublished: boolean;
```

Result — the end of `StudioRecording` should look like:
```ts
  syncAttempts: number;
  lastSyncError: string | null;
  coverUrl: string | null;
  bgUrl: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Map the new fields in fromRemoteRow**

In `fromRemoteRow` (around line 763), it calls `coerceStudioRecording({...})`. Add three entries to the object, after `updatedAt`:

Find this block at the end of the object passed to `coerceStudioRecording`:
```ts
    syncStatus: 'synced',
    syncAttempts: 0,
    lastSyncError: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
```

Replace it with:
```ts
    syncStatus: 'synced',
    syncAttempts: 0,
    lastSyncError: null,
    coverUrl: row.cover_url ?? null,
    bgUrl: row.bg_url ?? null,
    isPublished: row.is_published ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
```

- [ ] **Step 3: Add defaults in coerceStudioRecording**

`coerceStudioRecording` is defined at line 360 of `src/lib/elderStudio.ts`. Find this block near the end of the function (around line 393):

```ts
  syncAttempts: recording.syncAttempts ?? 0,
  lastSyncError: recording.lastSyncError ?? null,
  createdAt: recording.createdAt ?? new Date().toISOString(),
  updatedAt: recording.updatedAt ?? recording.createdAt ?? new Date().toISOString(),
});
```

Replace it with:

```ts
  syncAttempts: recording.syncAttempts ?? 0,
  lastSyncError: recording.lastSyncError ?? null,
  coverUrl: recording.coverUrl ?? null,
  bgUrl: recording.bgUrl ?? null,
  isPublished: recording.isPublished ?? false,
  createdAt: recording.createdAt ?? new Date().toISOString(),
  updatedAt: recording.updatedAt ?? recording.createdAt ?? new Date().toISOString(),
});
```

- [ ] **Step 4: Verify tests still pass**

Run: `npm run test:run -- --bail 1`

Expected: all 106 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/elderStudio.ts
git commit -m "feat: add coverUrl, bgUrl, isPublished to StudioRecording type"
```

---

## Task 4: Create storyImages.ts lib and tests

**Files:**
- Create: `src/lib/storyImages.ts`
- Create: `src/lib/storyImages.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/storyImages.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    from: vi.fn(),
  },
}));

import { supabase } from './supabase';
import { generateStoryVisuals, publishRecordingAsStory } from './storyImages';

describe('generateStoryVisuals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns coverUrl and bgUrl on success', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { coverUrl: 'https://example.com/cover.png', bgUrl: 'https://example.com/bg.png' },
      error: null,
    });

    const result = await generateStoryVisuals('rec-1', 'Kancil', 'A story about a deer');

    expect(result).toEqual({
      coverUrl: 'https://example.com/cover.png',
      bgUrl: 'https://example.com/bg.png',
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('generate-story-cover', {
      body: { recordingId: 'rec-1', title: 'Kancil', description: 'A story about a deer' },
    });
  });

  it('throws when the function returns an error', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: { message: 'Edge function error' },
    });

    await expect(generateStoryVisuals('rec-1', 'Kancil', '')).rejects.toThrow(
      'Edge function error',
    );
  });

  it('throws when response is missing URLs', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { coverUrl: null, bgUrl: null },
      error: null,
    });

    await expect(generateStoryVisuals('rec-1', 'Kancil', '')).rejects.toThrow('incomplete data');
  });
});

describe('publishRecordingAsStory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates the recording with cover_url, bg_url, and is_published=true', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as ReturnType<typeof supabase.from>);

    await publishRecordingAsStory('rec-1', 'https://cover.png', 'https://bg.png');

    expect(supabase.from).toHaveBeenCalledWith('recordings');
    expect(mockUpdate).toHaveBeenCalledWith({
      cover_url: 'https://cover.png',
      bg_url: 'https://bg.png',
      is_published: true,
    });
    expect(mockEq).toHaveBeenCalledWith('id', 'rec-1');
  });

  it('throws when the update fails', async () => {
    const mockEq = vi.fn().mockResolvedValue({ error: { message: 'Update failed' } });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as ReturnType<typeof supabase.from>);

    await expect(
      publishRecordingAsStory('rec-1', 'https://cover.png', 'https://bg.png'),
    ).rejects.toThrow('Update failed');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/storyImages.test.ts`

Expected: FAIL — `Cannot find module './storyImages'`

- [ ] **Step 3: Create the lib**

Create `src/lib/storyImages.ts`:

```ts
import { supabase } from './supabase';

export type GeneratedStoryVisuals = {
  coverUrl: string;
  bgUrl: string;
};

export async function generateStoryVisuals(
  recordingId: string,
  title: string,
  description: string,
): Promise<GeneratedStoryVisuals> {
  const { data, error } = await supabase.functions.invoke('generate-story-cover', {
    body: { recordingId, title, description },
  });

  if (error) {
    throw new Error((error as { message?: string }).message ?? 'Image generation failed');
  }

  const result = data as { coverUrl?: string | null; bgUrl?: string | null };
  if (!result?.coverUrl || !result?.bgUrl) {
    throw new Error('Image generation returned incomplete data');
  }

  return { coverUrl: result.coverUrl, bgUrl: result.bgUrl };
}

export async function publishRecordingAsStory(
  recordingId: string,
  coverUrl: string,
  bgUrl: string,
): Promise<void> {
  const { error } = await supabase
    .from('recordings')
    .update({ cover_url: coverUrl, bg_url: bgUrl, is_published: true })
    .eq('id', recordingId);

  if (error) {
    throw new Error(error.message ?? 'Failed to publish story');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/storyImages.test.ts`

Expected: 5 tests pass.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `npm run test:run -- --bail 1`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storyImages.ts src/lib/storyImages.test.ts
git commit -m "feat: add storyImages lib with generateStoryVisuals and publishRecordingAsStory"
```

---

## Task 5: Edge function generate-story-cover

**Files:**
- Create: `supabase/functions/generate-story-cover/index.ts`

- [ ] **Step 1: Create the edge function**

Create `supabase/functions/generate-story-cover/index.ts`:

```ts
declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const IMAGE_MODEL = 'openai/gpt-image-2';

async function generateImage(prompt: string): Promise<Uint8Array> {
  const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as { data: Array<{ b64_json: string }> };
  const b64 = json.data[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenRouter returned no image data');
  }

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function uploadToStorage(path: string, data: Uint8Array): Promise<string> {
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/stories/${path}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: data,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Storage upload error ${response.status}: ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/stories/${path}`;
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse(401, { error: 'Missing authorization' });
  }

  let body: { recordingId?: string; title?: string; description?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { recordingId, title, description } = body;

  if (!title?.trim()) {
    return jsonResponse(400, { error: 'title is required' });
  }

  if (!recordingId?.trim()) {
    return jsonResponse(400, { error: 'recordingId is required' });
  }

  const descriptionPart = description?.trim() ? ` ${description.trim()}.` : '';

  const coverPrompt = `An illustrated children's book cover for a Semai Malaysian folklore story titled "${title}".${descriptionPart} Traditional rainforest setting, warm earthy tones, vibrant and detailed illustration style.`;
  const bgPrompt = `A wide panoramic illustrated scene from the Semai Malaysian folklore story "${title}".${descriptionPart} Lush jungle landscape, soft watercolor atmosphere, cinematic background painting.`;

  try {
    const [coverBytes, bgBytes] = await Promise.all([
      generateImage(coverPrompt),
      generateImage(bgPrompt),
    ]);

    const [coverUrl, bgUrl] = await Promise.all([
      uploadToStorage(`${recordingId}-cover.png`, coverBytes),
      uploadToStorage(`${recordingId}-bg.png`, bgBytes),
    ]);

    return jsonResponse(200, { coverUrl, bgUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    if (message.startsWith('OpenRouter')) {
      return jsonResponse(500, { error: 'Image generation failed' });
    }
    return jsonResponse(500, { error: 'Storage upload failed' });
  }
});
```

- [ ] **Step 2: Set the OpenRouter secret**

Run (replace with your real key):
```bash
npx supabase secrets set OPENROUTER_API_KEY=sk-or-...
```

Expected: `Finished supabase secrets set.`

- [ ] **Step 3: Serve and smoke-test locally**

In a separate terminal:
```bash
npx supabase functions serve generate-story-cover --env-file .env
```

In another terminal (replace `<JWT>` with a valid user JWT from the browser dev tools Network tab):
```bash
curl -X POST http://localhost:54321/functions/v1/generate-story-cover \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"recordingId":"test-123","title":"Kancil","description":"A clever deer story"}'
```

Expected response shape: `{"coverUrl":"https://...","bgUrl":"https://..."}`

- [ ] **Step 4: Deploy the function**

```bash
npx supabase functions deploy generate-story-cover
```

Expected: `Deployed Function generate-story-cover`

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/generate-story-cover/index.ts
git commit -m "feat: add generate-story-cover edge function using OpenRouter GPT Image 2"
```

---

## Task 6: Publish flow UI in SoundArchiveTab

**Files:**
- Modify: `src/pages/SoundArchiveTab.tsx`
- Create: `src/pages/SoundArchiveTab.css`

- [ ] **Step 1: Create the CSS file for publish flow thumbnails**

Create `src/pages/SoundArchiveTab.css`:

```css
.studio-publish-generate,
.studio-publish-confirm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 20px 32px;
}

.studio-publish-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.studio-publish-excerpt {
  font-size: 13px;
  color: var(--ion-color-medium, #777);
  line-height: 1.5;
  margin: 0;
}

.studio-publish-previews {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.studio-publish-preview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.studio-publish-preview-item span {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ion-color-medium, #777);
}

.studio-publish-preview-item img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}

.studio-published-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 99px;
  background: #e8f5e9;
  color: #2e7d32;
}
```

- [ ] **Step 2: Add import and new state to SoundArchiveTab**

At the top of `SoundArchiveTab.tsx`, add the CSS import after the existing imports:

```ts
import './SoundArchiveTab.css';
```

Add these imports inside the existing import block from `'../lib/elderStudio'` line:

```ts
import { generateStoryVisuals, publishRecordingAsStory } from '../lib/storyImages';
import type { GeneratedStoryVisuals } from '../lib/storyImages';
```

Inside `SoundArchiveTab()`, after the existing `const [toast, setToast]` state line, add:

```ts
  const [publishFlowRecordingId, setPublishFlowRecordingId] = useState<string | null>(null);
  const [publishStep, setPublishStep] = useState<'generate' | 'confirm'>('generate');
  const [generatedVisuals, setGeneratedVisuals] = useState<GeneratedStoryVisuals | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
```

- [ ] **Step 3: Add the three handler functions**

After `handleRetryTranscription` (around line 299), add:

```ts
  const handleOpenPublishFlow = (recording: StudioRecording) => {
    triggerHapticFeedback('light');
    setPublishFlowRecordingId(recording.id);
    setPublishStep('generate');
    setGeneratedVisuals(null);
  };

  const handleClosePublishFlow = () => {
    setPublishFlowRecordingId(null);
    setPublishStep('generate');
    setGeneratedVisuals(null);
  };

  const handleGenerateVisuals = async (recording: StudioRecording) => {
    setIsGenerating(true);
    try {
      const visuals = await generateStoryVisuals(
        recording.id,
        recording.title,
        recording.description ?? '',
      );
      setGeneratedVisuals(visuals);
      setPublishStep('confirm');
      triggerHapticFeedback('success');
    } catch (error) {
      setToast({
        color: 'danger',
        message: error instanceof Error ? error.message : 'Image generation failed.',
      });
      triggerHapticFeedback('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublishStory = async (recording: StudioRecording) => {
    if (!generatedVisuals) {
      return;
    }
    setIsPublishing(true);
    try {
      await publishRecordingAsStory(
        recording.id,
        generatedVisuals.coverUrl,
        generatedVisuals.bgUrl,
      );
      setRecordings((current) =>
        upsertStudioRecordingInList(current, {
          ...recording,
          coverUrl: generatedVisuals.coverUrl,
          bgUrl: generatedVisuals.bgUrl,
          isPublished: true,
        }),
      );
      setToast({ color: 'success', message: 'Story published.' });
      handleClosePublishFlow();
      triggerHapticFeedback('success');
    } catch (error) {
      setToast({
        color: 'danger',
        message: error instanceof Error ? error.message : 'Failed to publish story.',
      });
      triggerHapticFeedback('error');
    } finally {
      setIsPublishing(false);
    }
  };
```

- [ ] **Step 4: Add "Publish as Story" button to the recording footer**

In the recording footer JSX (around line 548, after the "Review" button), add a "Publish as Story" button and a "Published" badge. Find:

```tsx
                      {recording.syncStatus === 'synced' ? (
                        <button
                          type="button"
                          className="studio-recording-action-button is-primary"
                          onClick={handleOpenReviewQueue}
                        >
                          Review
                        </button>
                      ) : null}
```

Replace with:

```tsx
                      {recording.syncStatus === 'synced' ? (
                        <button
                          type="button"
                          className="studio-recording-action-button is-primary"
                          onClick={handleOpenReviewQueue}
                        >
                          Review
                        </button>
                      ) : null}

                      {recording.syncStatus === 'synced' &&
                      recording.isVerified &&
                      !recording.isPublished &&
                      recording.recordingType === 'story' ? (
                        <button
                          type="button"
                          className="studio-recording-action-button is-primary"
                          onClick={() => handleOpenPublishFlow(recording)}
                        >
                          Publish as Story
                        </button>
                      ) : null}

                      {recording.isPublished ? (
                        <span className="studio-published-badge">Published</span>
                      ) : null}
```

- [ ] **Step 5: Add the publish flow overlay**

In the `return` JSX, just before the `<IonToast` element at the bottom, add:

```tsx
      {publishFlowRecordingId
        ? (() => {
            const rec = recordings.find((r) => r.id === publishFlowRecordingId);
            if (!rec) {
              return null;
            }
            return (
              <div className="studio-flow-screen" role="dialog" aria-modal="true">
                <div className="studio-flow-shell studio-flow-shell--details">
                  <header className="studio-flow-header">
                    <button
                      type="button"
                      className="studio-flow-back-button"
                      onClick={handleClosePublishFlow}
                    >
                      <IonIcon aria-hidden icon={arrowBackOutline} />
                    </button>
                    <h2>
                      {publishStep === 'generate' ? 'Generate Visuals' : 'Confirm & Publish'}
                    </h2>
                    <span className="studio-flow-header-spacer" aria-hidden="true" />
                  </header>

                  {publishStep === 'generate' ? (
                    <div className="studio-publish-generate">
                      <p className="studio-publish-title">{rec.title}</p>
                      {resolveStudioRecordingTranscription(rec) ? (
                        <p className="studio-publish-excerpt">
                          {toPreviewText(resolveStudioRecordingTranscription(rec) ?? '', 200)}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="studio-save-button"
                        onClick={() => void handleGenerateVisuals(rec)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <IonSpinner name="crescent" />
                            <span>Generating visuals…</span>
                          </>
                        ) : (
                          'Generate Cover & Background'
                        )}
                      </button>
                      <button
                        type="button"
                        className="studio-discard-link"
                        onClick={handleClosePublishFlow}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="studio-publish-confirm">
                      {generatedVisuals ? (
                        <div className="studio-publish-previews">
                          <div className="studio-publish-preview-item">
                            <span>Cover</span>
                            <img src={generatedVisuals.coverUrl} alt="Generated story cover" />
                          </div>
                          <div className="studio-publish-preview-item">
                            <span>Background</span>
                            <img
                              src={generatedVisuals.bgUrl}
                              alt="Generated story background"
                            />
                          </div>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        className="studio-recording-action-button"
                        onClick={() => void handleGenerateVisuals(rec)}
                        disabled={isGenerating}
                      >
                        {isGenerating ? 'Regenerating…' : 'Regenerate'}
                      </button>
                      <button
                        type="button"
                        className="studio-save-button"
                        onClick={() => void handlePublishStory(rec)}
                        disabled={isPublishing || !generatedVisuals}
                      >
                        {isPublishing ? (
                          <>
                            <IonSpinner name="crescent" />
                            <span>Publishing…</span>
                          </>
                        ) : (
                          'Publish Story'
                        )}
                      </button>
                      <button
                        type="button"
                        className="studio-discard-link"
                        onClick={handleClosePublishFlow}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })()
        : null}
```

- [ ] **Step 6: Run typecheck and all tests**

Run: `npm run typecheck && npm run test:run -- --bail 1`

Expected: typecheck passes, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/SoundArchiveTab.tsx src/pages/SoundArchiveTab.css
git commit -m "feat: add Publish as Story flow to SoundArchiveTab with GPT Image 2 cover generation"
```
