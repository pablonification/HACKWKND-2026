# HACKWKND 2026

## Repository Rules

### Branch Protection (Main)

- **Direct push to main: BLOCKED** — all changes must go through PR
- **Pull request required** — minimum 1 approval before merge
- **Force push: ALLOWED for owner only**
- **Branch deletion: BLOCKED**

### Merge Permissions

Only `pablonification` can merge PRs to main.

### Code Review Requirements

All PRs are automatically reviewed by Greptile AI. Minimum confidence score: **4/5** required before merge.

## Participant Workflow

### Quick Start

```bash
# Clone repo (if invited as collaborator)
git clone https://github.com/pablonification/HACKWKND-2026.git
cd HACKWKND-2026

# Create feature branch
git checkout -b branch-name
git push -u origin branch-name

# Make changes, commit, push
git add .
git commit -m "feat: description"
git push
```

### Submit Changes

1. Push your branch to origin
2. Open Pull Request via GitHub
3. Wait for review and merge by the owner

### Alternative: Fork Workflow

If not added as collaborator:

```bash
# Fork via GitHub UI first, then:
git clone https://github.com/YOUR_USERNAME/HACKWKND-2026.git

# Add upstream remote
git remote add upstream https://github.com/pablonification/HACKWKND-2026.git

# Create branch, make changes, push to your fork
git checkout -b feature-name
git push origin feature-name

# Open PR from your fork to main repo
```

## Project Structure

```
.
├── LICENSE           # MIT License
├── README.md         # This file
├── ai-helper/        # OmniASR proxy (`/ai/transcribe`)
└── src/              # Ionic + React app
```

## AI Helper (Semai ASR)

Elder Studio transcription uses `VITE_AI_BASE_URL` and calls `POST /ai/transcribe`.

Run the proxy locally:

```bash
npm run ai-helper:dev
```

Then set frontend env:

```bash
VITE_AI_BASE_URL=http://localhost:8787
```

## AI Coach (Supabase Edge Function)

The personal AI coach uses the `ai-coach` edge function and reuses the project glossary and
sentence-memory assets for grounded Semai responses.

Set these edge-function secrets for coach generation:

```bash
GOOGLE_AI_STUDIO_API_KEY=your_google_ai_studio_key
AI_COACH_GEMINI_MODEL=gemini-3.1-flash-lite-preview
```

Optional overrides:

```bash
GOOGLE_AI_STUDIO_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_COACH_TIMEOUT_MS=12000
```

## License

MIT License — see [LICENSE](LICENSE) for details.
