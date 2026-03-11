# AI Coach Candidate Selection Fixes - Notepad

## Investigation Summary

### Root Causes Identified

1. **Topic Selection Ignored**: `pickVerifiedLearningCandidate` doesn't receive topic hint
2. **Scoring Imbalanced**: Curated MVP gets +8, Webonary gets +2 (category mismatch)
3. **Dedup Window Too Small**: Only last 6 messages tracked
4. **Continue Falls Back**: Generic "vocabulary" seed every time
5. **No Randomization**: Deterministic sorting always returns same order

### Key Data Structures

- `VerifiedLearningCandidate`: { id, semai, translation, source, score }
- Webonary categories: 'kata nama', 'kata kerja', 'kata sifat', 'kata keterangan', 'kata seru', etc.
- Track categories: 'nature', 'family', 'food', 'phrase'

### Files to Modify

1. `supabase/functions/_shared/coachGrounding.ts` - dedup logic
2. `supabase/functions/ai-coach/index.ts` - scoring, candidate selection
3. `supabase/functions/_shared/translationGlossary.ts` - category mapping

## Implementation Progress

### TBD
