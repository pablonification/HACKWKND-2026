# ChatGPT Proxy Demo Runbook

Use this flow when Taleka needs ChatGPT/Codex subscription inference for the AI Coach during a controlled demo.

## Local Services

Run these on the demo laptop:

```bash
npx --yes openai-oauth --oauth-file ~/.codex/auth.json --host 127.0.0.1 --port 10531
TALEKA_DEMO_PROXY_KEY=<shared-secret> npm run demo:ai-gateway
cloudflared tunnel --url http://127.0.0.1:10532
```

Service chain:

```text
Supabase ai-coach
  -> Cloudflare Tunnel URL /v1
  -> Taleka demo gateway :10532
  -> openai-oauth :10531
  -> chatgpt.com/backend-api/codex
```

## Supabase Secrets

```bash
AI_COACH_PROVIDER_ORDER=chatgpt-proxy,gemini
AI_COACH_OPENAI_BASE_URL=https://<cloudflare-url>/v1
AI_COACH_OPENAI_API_KEY=<shared-secret>
AI_COACH_OPENAI_MODEL=<confirmed-model>
GOOGLE_AI_STUDIO_API_KEY=<gemini-key>
AI_COACH_GEMINI_MODEL=gemini-3.1-flash-lite-preview
```

Use `curl` to confirm the model list before choosing `AI_COACH_OPENAI_MODEL`:

```bash
curl -H "Authorization: Bearer <shared-secret>" https://<cloudflare-url>/v1/models
```

## Demo Checklist

1. Refresh the ChatGPT token using the existing `codexpls` flow.
2. Start `openai-oauth` and verify `http://127.0.0.1:10531/v1/models`.
3. Start the Taleka demo gateway and verify authenticated `/v1/models`.
4. Start Cloudflare Tunnel and set the Supabase secrets.
5. Deploy or restart `ai-coach`.
6. Run one AI Coach smoke prompt.
7. Keep the laptop awake and plugged in during judging.

If the proxy, tunnel, or token fails, `ai-coach` falls back to Gemini and then to deterministic rule-based responses.
