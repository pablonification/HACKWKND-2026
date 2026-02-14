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
└── (add your files here)
```

## License

MIT License — see [LICENSE](LICENSE) for details.
