# Semai Translation Review Workflow

This workflow operationalizes TALEKA's translation quality goals for Semai, Malay, and English.

## 1) Automated Evaluation

Run the evaluation suite against the deployed `ai-translate` function:

```bash
npm run eval:translation
```

Inputs:
- `docs/final/SEMAI_TRANSLATION_EVAL_SET.json`
- `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` from your local `.env`

Output:
- `docs/final/SEMAI_TRANSLATION_EVAL_REPORT.md`

Gate:
- Any failed `critical` case blocks release of translation changes.
- Tier A must remain 100% pass rate.
- If warning or fallback responses spike above baseline, hold release and review glossary/model routing changes.

## 2) Tiered Interpretation

The eval set is grouped into three release tiers:

| Tier | Purpose | Release requirement |
|---|---|---|
| A | Cultural and glossary-critical terms | Must be 100% pass |
| B | Short sentence quality | Track trend; review failures |
| C | Longer robustness and warning behavior | Track trend; review failures |

## 3) Elder/Community Manual Review

After the automated run passes critical checks, review the latest report with at least one Semai speaker or language keeper.

For each failed or uncertain case, score:

| Dimension | Score | Rule |
|---|---|---|
| Meaning fidelity | 0/1 | Core meaning preserved |
| Cultural term integrity | 0/1 | Important terms are not mistranslated |
| Fluency | 0/1 | Output is natural in target language |

Decision:
- **Accept**: total score 3/3
- **Revise glossary**: any score <3/3 on culturally sensitive terms (`bobolian`, `bobohiz`, `tong`, etc.)

## 4) Update Cycle

When a term fails:
1. Add or correct the term in `supabase/functions/_shared/translationGlossary.ts`
2. Add a targeted case in `docs/final/SEMAI_TRANSLATION_EVAL_SET.json`
3. Re-run `npm run eval:translation`
4. Re-deploy `ai-translate` if backend changed

## 5) Offline Safety

If SEA-LION is unavailable, the function returns glossary dictionary fallback translation and a warning message.
This keeps the feature usable in constrained network conditions (aligned with TALEKA offline-first goals).
