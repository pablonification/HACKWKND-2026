const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ElevenLabs voice ID for a neutral, clear voice (Rachel)
const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Require a valid authenticated user — reject anon/unauthenticated requests
  // so that only signed-in users can spend ElevenLabs quota.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Supabase env vars not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Verify the JWT by calling Supabase Auth — rejects expired/anon tokens.
  const userRes = await fetch(supabaseUrl + '/auth/v1/user', {
    headers: { Authorization: 'Bearer ' + jwt, apikey: supabaseAnonKey },
  });
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const text = body.text;

    // speed is a top-level ElevenLabs field, NOT nested inside voice_settings.
    const speed = typeof body.speed === 'number' ? body.speed : undefined;

    // Accept caller-supplied voice_settings; fall back to sensible defaults.
    // Field names mirror the ElevenLabs API exactly (stability, similarity_boost,
    // style, use_speaker_boost).
    const callerSettings =
      body.voice_settings && typeof body.voice_settings === 'object' ? body.voice_settings : {};

    const voiceSettings = {
      stability: typeof callerSettings.stability === 'number' ? callerSettings.stability : 0.5,
      similarity_boost:
        typeof callerSettings.similarity_boost === 'number'
          ? callerSettings.similarity_boost
          : 0.75,
      ...(typeof callerSettings.style === 'number' && { style: callerSettings.style }),
      ...(typeof callerSettings.use_speaker_boost === 'boolean' && {
        use_speaker_boost: callerSettings.use_speaker_boost,
      }),
    };

    if (!text) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const elevenLabsKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsKey) {
      return new Response(JSON.stringify({ error: 'ELEVENLABS_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Supabase env vars not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call ElevenLabs TTS
    const ttsResponse = await fetch(
      'https://api.elevenlabs.io/v1/text-to-speech/' + ELEVENLABS_VOICE_ID,
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_turbo_v2_5',
          language_code: 'ms',
          ...(speed !== undefined && { speed }),
          voice_settings: voiceSettings,
        }),
      },
    );

    if (!ttsResponse.ok) {
      const err = await ttsResponse.text();
      return new Response(JSON.stringify({ error: 'ElevenLabs TTS error: ' + err }), {
        status: ttsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const fileName = 'tts_' + crypto.randomUUID() + '.mp3';
    const uploadUrl = supabaseUrl + '/storage/v1/object/pronunciations/tts/' + fileName;

    // Upload to Supabase Storage
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + supabaseServiceKey,
        apikey: supabaseServiceKey,
        'Content-Type': 'audio/mpeg',
        'x-upsert': 'false',
      },
      body: audioBuffer,
    });

    if (!uploadResponse.ok) {
      const err = await uploadResponse.text();
      return new Response(JSON.stringify({ error: 'Storage upload error: ' + err }), {
        status: uploadResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build a short-lived signed URL (5 minutes) so the caller can stream the
    // audio without keeping a permanent file in storage.
    const signedUrlRes = await fetch(
      supabaseUrl + '/storage/v1/object/sign/pronunciations/tts/' + fileName,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + supabaseServiceKey,
          apikey: supabaseServiceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 300 }),
      },
    );

    // Schedule deletion regardless of whether signed-URL generation succeeded.
    // Fire-and-forget: the response is already determined, so we don't await.
    void fetch(
      supabaseUrl + '/storage/v1/object/pronunciations/tts/' + fileName,
      {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer ' + supabaseServiceKey,
          apikey: supabaseServiceKey,
        },
      },
    );

    if (!signedUrlRes.ok) {
      // Fallback: return the public URL even though the file will be deleted soon.
      const publicUrl = supabaseUrl + '/storage/v1/object/public/pronunciations/tts/' + fileName;
      return new Response(JSON.stringify({ audio_url: publicUrl }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { signedURL } = await signedUrlRes.json() as { signedURL: string };
    const audio_url = supabaseUrl + '/storage/v1' + signedURL;

    return new Response(JSON.stringify({ audio_url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
