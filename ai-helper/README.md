# AI Helper (OmniASR Proxy)

This service implements `POST /ai/transcribe` for TALEKA and forwards audio to Meta OmniASR with Semai (`sea_Latn`) by default.

## Why it exists

- Frontend contract is JSON: `{ "audio_url": "..." }`.
- OmniASR contract is multipart upload: `media=<file>`.
- Recordings bucket is private, so the proxy downloads audio with Supabase service role credentials first.

## Endpoints

- `GET /health`
- `GET /health?deep=1` (also checks upstream OmniASR health)
- `POST /ai/transcribe`

Request:

```json
{
  "audio_url": "user-id/recording-id.webm"
}
```

Response:

```json
{
  "transcription": "..."
}
```

## Run locally (uses root `.env`)

Use the existing root `.env` file and add these keys there:

```bash
VITE_AI_BASE_URL=http://localhost:8787
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service reads root `.env` automatically when started and uses `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

Start the helper:

```bash
npm run ai-helper:dev
```

## Notes

- Default provider: `https://facebook-omniasr-transcriptions.hf.space`
- Default language: `sea_Latn`
- If OmniASR is busy/unavailable, this service returns a clear 5xx error.
