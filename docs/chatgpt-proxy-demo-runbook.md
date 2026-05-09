# Claude Agent SDK AI Coach Demo Runbook

Use this flow when Taleka needs Claude subscription-backed inference for the AI Coach during a controlled demo.

Important: Claude Agent SDK cannot run inside the Supabase Edge Function runtime. Keep Supabase as the orchestrator, and run a small Node gateway on the demo laptop or another trusted Node host.

## Service Chain

```text
Taleka app
  -> Supabase ai-coach Edge Function
  -> protected HTTPS gateway URL /v1/chat/completions
  -> local Taleka Claude Agent SDK gateway
  -> Claude Agent SDK / Claude Code auth
```

## Local Gateway

Run this on a machine where Claude Code authentication is already working:

```bash
TALEKA_CLAUDE_AGENT_KEY=<shared-secret> \
TALEKA_CLAUDE_AGENT_RETRY_COUNT=2 \
TALEKA_CLAUDE_AGENT_RETRY_DELAY_MS=900 \
npm run demo:claude-agent-gateway
```

The gateway listens on `127.0.0.1:10535` by default and exposes:

```text
GET  /v1/models
POST /v1/chat/completions
```

Expose the gateway to Supabase with a protected HTTPS URL, such as a Cloudflare Tunnel pointed at `http://127.0.0.1:10535`.

## Supabase Secrets

```bash
AI_COACH_PROVIDER_ORDER=claude-agent,gemini
AI_COACH_CLAUDE_AGENT_BASE_URL=https://<gateway-url>/v1
AI_COACH_CLAUDE_AGENT_API_KEY=<shared-secret>
AI_COACH_CLAUDE_AGENT_MODEL=sonnet
GOOGLE_AI_STUDIO_API_KEY=<gemini-key>
AI_COACH_GEMINI_MODEL=gemini-3.1-flash-lite-preview
AI_COACH_TIMEOUT_MS=45000
AI_COACH_PROVIDER_RETRY_COUNT=1
AI_COACH_PROVIDER_RETRY_DELAY_MS=900
```

## Demo Checklist

1. Confirm Claude Code works on the gateway machine.
2. Start the Taleka Claude Agent SDK gateway.
3. Verify authenticated `/v1/models`.
4. Expose the gateway through HTTPS.
5. Set or refresh the Supabase secrets above.
6. Deploy or restart `ai-coach`.
7. Run one AI Coach smoke prompt before judging.
8. Confirm response metadata shows `provider: "claude-agent"` and `model: "sonnet"`.
9. Keep Gemini secrets configured so `ai-coach` can fall back if the Claude gateway fails.

If the Claude Agent SDK gateway returns a timeout, auth failure, rate limit, server error, invalid JSON, or empty text, `ai-coach` falls back to Gemini and then to deterministic rule-based responses.
