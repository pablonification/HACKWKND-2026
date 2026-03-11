declare const Deno: {
  env: { get: (name: string) => string | undefined };
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
};

import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { WEBONARY_GLOSSARY } from '../_shared/webonaryGlossary.generated.ts';

// ─── UUID v5 helper ──────────────────────────────────────────────────────────
// Generates a deterministic UUID v5 from a slug so the same word always gets
// the same UUID — safe to re-run without duplicates.
// Namespace: 6ba7b810-9dad-11d1-80b4-00c04fd430c8  (URL namespace per RFC 4122)
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function uuidV5(name: string): Promise<string> {
  const nsBytes = hexToBytes(UUID_NAMESPACE);
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(nsBytes.length + nameBytes.length);
  combined.set(nsBytes);
  combined.set(nameBytes, nsBytes.length);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const hash = new Uint8Array(hashBuffer);

  // Set version (5) and variant bits
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = bytesToHex(hash.slice(0, 16));
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// ─── Difficulty mapping ───────────────────────────────────────────────────────
function toDifficulty(category: string): 'beginner' | 'intermediate' | 'advanced' {
  const c = category.toLowerCase();
  if (c === 'kata nama' || c === 'person' || c === 'building' || c === 'food') return 'beginner';
  if (c === 'kata kerja' || c === 'kata sifat') return 'intermediate';
  return 'beginner';
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!serviceRoleKey || !supabaseUrl) {
    return jsonResponse(500, { error: 'Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL' });
  }

  // The Supabase gateway already validates the JWT.
  // We additionally confirm the caller used the service-role key
  // by checking the decoded 'role' claim in the token payload.
  const authHeader = request.headers.get('Authorization') ?? '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  try {
    const payloadB64 = bearerToken.split('.')[1] ?? '';
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as { role?: string };
    if (payload.role !== 'service_role') {
      return jsonResponse(403, { error: 'Forbidden — service-role key required' });
    }
  } catch {
    return jsonResponse(401, { error: 'Unauthorized — invalid token' });
  }

  try {
    // Build rows with deterministic UUIDs.
    // Only using columns guaranteed present from the initial_schema migration:
    // id, semai_word, english_translation, malay_translation, topic_tags, difficulty
    const rows = await Promise.all(
      WEBONARY_GLOSSARY.map(async (entry) => ({
        id: await uuidV5(`webonary:${entry.id}`),
        semai_word: entry.semai,
        english_translation: entry.en,
        malay_translation: entry.ms,
        topic_tags: [entry.category],
        difficulty: toDifficulty(entry.category),
      })),
    );

    // Batch upsert in chunks of 200 to avoid request size limits
    const CHUNK = 200;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const res = await fetch(`${supabaseUrl}/rest/v1/words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          Prefer: 'resolution=ignore-duplicates,return=representation',
        },
        body: JSON.stringify(chunk),
      });

      if (!res.ok) {
        const err = await res.text();
        return jsonResponse(500, {
          error: `Batch ${i / CHUNK + 1} failed`,
          detail: err,
          inserted,
        });
      }

      const data: unknown[] = await res.json();
      inserted += data.length;
      skipped += chunk.length - data.length;
    }

    return jsonResponse(200, {
      message: 'Seed complete',
      total: rows.length,
      inserted,
      skipped,
    });
  } catch (err) {
    return jsonResponse(500, {
      error: 'Unexpected error',
      detail: String(err),
    });
  }
});
