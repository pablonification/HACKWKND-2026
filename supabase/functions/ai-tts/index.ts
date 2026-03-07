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

  try {
    const body = await req.json();
    const text = body.text;

    // Accept caller-supplied voice_settings; fall back to sensible defaults.
    // Field names mirror the ElevenLabs API exactly (stability, similarity_boost,
    // style, use_speaker_boost) — NOT the old speed/pitch contract.
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseServiceKey) {
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

    const publicUrl = supabaseUrl + '/storage/v1/object/public/pronunciations/tts/' + fileName;

    return new Response(JSON.stringify({ audio_url: publicUrl }), {
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
