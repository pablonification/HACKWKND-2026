# AGENTS.md

Project-specific instructions for contributors and coding agents.

## Workflow Rules

1. Always run pre-commit checks before pushing or opening/updating a PR.
2. Do not push broken code. If checks fail, fix first, then re-run.
3. Use small, grouped commits by concern (e.g. `chore`, `feat`, `fix`, `docs`).
4. Keep TypeScript strict and type-safe. Avoid `any` unless there is a strong reason.
5. Add or update tests for non-trivial logic changes.

## Mandatory Commands Before Push/PR

Run these from the repository root:

```bash
npm run precommit
```

If needed, also run:

```bash
npm run check
```

## Design and UX Standards

The app should feel pleasant and polished to use.

1. Every interactive element should have clear touch feedback.
2. Add subtle micro-animations for key actions:
   - Button press in/out
   - Navigation and screen transitions
   - Input focus/validation feedback
   - Small state changes (toggle, checkbox, dropdown, etc.)
3. Animations should be smooth and quick, not distracting.
4. Prefer consistent motion patterns across the app.
5. Prioritize usability and clarity over visual noise.
6. Utilize haptic feedback for meaningful interactions.

## Animation Guidelines

1. Keep interactions responsive (no laggy or heavy animation).
2. Use short durations for micro-interactions (typically ~100–220ms).
3. Use easing that feels natural.
4. Respect accessibility preferences where possible (reduced motion).
5. Avoid animations that block user actions.

## Haptic Feedback Guidelines

1. Add haptics to important user actions:
   - Primary button taps
   - Success states (save, submit, complete)
   - Error/invalid action feedback
   - Selection/toggle changes
2. Keep haptics subtle and intentional. Do not trigger on every tiny interaction.
3. Match haptic intensity to action importance.
4. Respect platform capability and graceful fallback (no crashes if unavailable).
5. Keep haptics synchronized with visual feedback/animation.

## PR Expectations

Before requesting review:

1. Confirm pre-commit checks pass.
2. Summarize what changed and why.
3. Call out known limitations or follow-up tasks.
