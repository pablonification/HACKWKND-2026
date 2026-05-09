declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const IMAGE_MODEL = 'openai/gpt-5.4-image-2';

type ImageType = 'cover' | 'bg';

type ContentPart =
  | { type: 'image_url'; image_url: { url: string } }
  | { type: string; [key: string]: unknown };

function buildPrompt(type: ImageType, title: string, descriptionPart: string): string {
  if (type === 'cover') {
    return `Create a beautiful illustrated children's storybook cover titled "${title}" inspired by Southeast Asian indigenous folklore and the Semai oral tradition.${descriptionPart} The cover design should closely reference a fantasy children's book aesthetic similar to classic Disney-style storybooks, with rich decorative borders made of tropical leaves, flowers, vines, and forest elements surrounding the frame. In the center foreground, feature a young Semai child standing beside a glowing river in an ancient rainforest while listening to a wise elder storyteller sitting near a warm campfire. Include magical floating particles, misty mountains, giant rainforest trees, and a peaceful indigenous village hut. Add a subtle mythical presence of Nyenang, the creator spirit, appearing softly in the sky made of glowing nature energy and mist. The title should appear in large bold fantasy typography at the top, with warm golden-yellow gradient letters and soft shadowing, similar to premium animated storybook covers. Under the title, include a smaller subtitle ribbon saying: "A Semai Creation Tale". Style: highly detailed 2D cartoon illustration, Disney Pixar inspired, vibrant tropical palette, cinematic warm lighting, magical folklore atmosphere, emotional and educational children's book cover, glossy illustrated storybook aesthetic, rich textures, whimsical fantasy vibe, mobile-app-friendly composition. Color palette: warm greens, golden sunlight, earthy browns, river blues, tropical flower colors, soft magical glow.`;
  }
  return `Create a colorful 2D storybook cartoon illustration inspired by Southeast Asian indigenous culture, especially the Semai community in Malaysia.${descriptionPart} Environment: lush tropical forest, traditional village houses, warm sunset lighting, rivers, mountains, nature elements, indigenous cultural motifs. Art style: Disney-style children's storybook illustration mixed with modern mobile app visuals, soft shading, expressive characters, cinematic composition, highly detailed, warm emotional atmosphere. Clothing and accessories inspired by Orang Asli / indigenous Southeast Asian traditions. Make the scene feel magical, educational, emotional, and culturally rich. Vibrant colors, immersive environment, kid-friendly, fantasy folklore vibes, high quality digital art.`;
}

async function generateImage(prompt: string): Promise<ArrayBuffer> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('OpenRouter failed:', response.status, text);
    throw new Error(`OpenRouter error ${response.status}: ${text}`);
  }

  const json = (await response.json()) as {
    choices: Array<{ message: { content: ContentPart[] | string } }>;
  };

  const content = json.choices[0]?.message?.content;
  const parts: ContentPart[] = Array.isArray(content)
    ? content
    : [{ type: 'image_url', image_url: { url: content as string } }];

  const imagePart = parts.find(
    (p): p is { type: 'image_url'; image_url: { url: string } } => p.type === 'image_url',
  );
  const dataUrl = imagePart?.image_url?.url ?? '';

  if (!dataUrl.startsWith('data:')) {
    console.error('OpenRouter returned no image data URL:', JSON.stringify(json).slice(0, 300));
    throw new Error('OpenRouter returned no image data');
  }

  const b64 = dataUrl.split(',')[1];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

async function uploadToStorage(path: string, data: ArrayBuffer): Promise<string> {
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

  let body: { recordingId?: string; title?: string; description?: string; type?: ImageType };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { recordingId, title, description, type } = body;

  if (!title?.trim()) {
    return jsonResponse(400, { error: 'title is required' });
  }

  if (!recordingId?.trim()) {
    return jsonResponse(400, { error: 'recordingId is required' });
  }

  const imageType: ImageType = type === 'bg' ? 'bg' : 'cover';
  const descriptionPart = description?.trim() ? ` ${description.trim()}.` : '';
  const prompt = buildPrompt(imageType, title.trim(), descriptionPart);
  const storagePath = `${recordingId}-${imageType}.png`;

  let imageData: ArrayBuffer;
  try {
    imageData = await generateImage(prompt);
  } catch {
    return jsonResponse(500, { error: 'Image generation failed' });
  }

  try {
    const url = await uploadToStorage(storagePath, imageData);
    return jsonResponse(200, imageType === 'cover' ? { coverUrl: url } : { bgUrl: url });
  } catch {
    return jsonResponse(500, { error: 'Storage upload failed' });
  }
});
