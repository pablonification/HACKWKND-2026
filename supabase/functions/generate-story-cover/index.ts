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
