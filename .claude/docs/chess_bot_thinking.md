# How the Chess Bot Thinks

This document explains the Level 7 bot's decision-making pipeline in detail. Levels 6 and 7 share the same architecture; Level 7 just searches one ply deeper.

**Config:** `depth=4, breadthPerDepth=[10,7,5,3], QUIESCE_DEPTH, GOAL_BASED_MOVE_GEN, BOARDSENSE_WITH_CONCEPTS`

---

## High-Level Flow

```
botMove(game, 7)
  → MoveEval.fromScratch()          // compute full material, positional, attackers
  → minimax(depth=4, isMaximizing=false)  // bot plays Black, starts minimizing
       → GOAL_BASED_MOVE_GEN        // MoveIdeas filter by priority
       → MoveEval.fromParent()      // per-candidate: update points + eval + SEE
       → sort by initialScore       // move ordering for alpha-beta efficiency
       → truncate to breadth[N]     // e.g. top 10 at depth 4→3
       → recurse ...
       → QUIESCE_DEPTH at depth=0   // extend if last move was a capture
       → BOARDSENSE_WITH_CONCEPTS   // leaf eval: material + positional + mobility + concepts
```

---

## Step 1: Candidate Move Generation (`GOAL_BASED_MOVE_GEN`)

Instead of generating all legal moves, the bot uses **`MoveIdeas`** — a prioritized list of strategic goals in `MoveIdeas.ts`. Each idea generates moves that serve that goal; the first idea to generate a given move "owns" it (duplicates dropped).

Ideas are sorted by priority, evaluated in order:

| Priority | Idea | What it generates |
|---|---|---|
| 100 | Capture unguarded piece | Captures where no enemy guards the target |
| 97 | Win material | Captures where attacker value < defender value |
| 95 | Flee from attack | Moves that get attacked pieces to safety |
| 90 | Attack undefended piece | Moves that attack undefended enemy pieces |
| 87 | Block attack | Interposes between attacker and attacked piece |
| 85 | Defend attacked piece | Moves that defend your own attacked pieces |
| 80 | Push center pawn (opening) | d/e pawn advances |
| 75 | Develop knight (opening) | Nf3, Nc3, Nf6, Nc6 (hardcoded) |
| 72 | Trade pieces (equal capture) | Equal-value captures |
| 70 | Develop bishop (opening) | Bb4/Bc4/Bc5/etc. (hardcoded) |
| 65 | Castle | O-O, O-O-O |
| 60 | Move King (endgame only) | King moves |
| 25 | Losing capture | Captures where attacker value > defender value |

**Capture classification** (`BoardSense.generateCapturesClassified`) uses the `attackersBySquare` map to count defenders on the destination square. A capture is:
- **Unguarded**: destination has 0 enemy defenders
- **Winning**: attacker value < captured piece value (e.g. pawn takes rook)
- **Equal**: attacker value ≈ captured piece value (within 1 point)
- **Losing**: attacker value > captured piece value AND destination is defended

If no ideas generate candidates, falls back to all legal moves.

Key files: `MoveIdeas.ts` (idea list), `MoveEval.ts:generateCandidateMoves`, `BoardSense.ts:generateCapturesClassified`

---

## Step 2: Minimax with Alpha-Beta Pruning (`MoveEval._minimax`)

The bot runs a 4-ply minimax tree. At each node:

1. **Generate candidates** via `GOAL_BASED_MOVE_GEN`
2. **Score each candidate** with `MoveEval.fromParent`:
   - Inherits parent's `materialPoints` and `positionalPoints`, applies incremental updates (captures, promotions, castling)
   - Calls `evalFunc` to compute `initialScore`
   - **SEE adjustment** (see Step 4)
3. **Sort by `initialScore`**: high-to-low for maximizer, low-to-high for minimizer
4. **Truncate to breadth limit** — only top N moves explored per node:
   - Depth 4→3 (root): top **10**
   - Depth 3→2: top **7**
   - Depth 2→1: top **5**
   - Depth 1→0: top **3**
5. **Recurse**, then pick `bestMove` by final subtree score
6. **Alpha-beta pruning** cuts branches that can't affect the result

Key file: `MoveEval.ts:_minimax`

---

## Step 3: Evaluation Function (`BOARDSENSE_WITH_CONCEPTS`)

Used at every leaf node (and for `initialScore` move ordering):

```
score = materialPointsAheadForWhite      // piece values (p=1 n=3 b=3 r=5 q=9)
      + positionalPointsAheadForWhite    // center control bonus (0–0.09 per piece)
      + mobilityDifference * 0.02        // 0.02 pts per extra legal move advantage
      + ChessConcepts adjustments
      + jitter()                         // tiny random noise to break ties
```

**Positional values** (`positionalValuesArray` in `MoveEval.ts`): center squares score higher (max 0.09 at d4/d5/e4/e5), edges score 0. Values are divided by 100.

**ChessConcepts** (`ChessConcepts.ts`) add strategic adjustments applied on top:
- `DontBringQueenEarly`: ±0.5 if a queen is off its home square in the first 7 moves (discourages early queen development)
- `AvoidTradesWhenBehind`: ±0.7 if the side making an equal trade is already down by 2+ material points (avoid simplifying when losing)

Key files: `ChessBot.ts:makeBoardsenseStrategy`, `ChessConcepts.ts`, `MoveEval.ts:findMaterialPoints/findPositionalPoints`

---

## Step 4: SEE Adjustment (Static Exchange Evaluation)

After `initialScore` is computed in `MoveEval.fromParent`, a penalty is applied for **losing captures**:

- If the moving piece is more valuable than the captured piece (e.g. knight takes pawn)
- AND the destination square is defended by an enemy piece

Then: `initialScore -= (movingValue - capturedValue)` (for White; += for Black)

This prevents losing captures from ranking above good moves in the breadth-limited move ordering. Without it, e.g. `Nxe4` (knight takes defended pawn) would appear near the top of the candidate list due to immediate material gain, waste a breadth slot, and crowd out genuinely good moves at depth layers with only 3-5 slots.

The penalty only affects `initialScore` (used for move ordering), not the actual minimax subtree score. A truly good sacrifice can still be found if it survives move ordering.

Key file: `MoveEval.ts:fromParent` (lines ~81–105)

**Regression test:** `SacrificeDetection.test.ts` — verifies the bot doesn't play `Nxe4` in the position after `1.e4 e5 2.Nf3 Nf6 3.Nc3 Bb4 4.Bc4 Nc6 5.d3`.

---

## Step 5: Quiescence Search (`QUIESCE_DEPTH`)

When depth reaches 0 and the last move was a capture, the bot **extends the search** instead of stopping cold. This avoids the "horizon effect" (missing recaptures just past the search horizon).

In quiescence mode:
- Compute a **stand-pat score** (evaluate the position without capturing). If it already beats the alpha/beta cutoff, stop.
- Otherwise, evaluate only captures (generated via `BoardSense.generateCaptures`)
- Max **5 extensions** total per branch

Key file: `ChessBot.ts:QUIESCE_DEPTH`, `MoveEval.ts:_minimax` (extensionsUsed logic)

---

## Bot Level Comparison

| Level | Depth | Breadth | Eval Strategy | Move Gen | Notable Features |
|---|---|---|---|---|---|
| 0 | 1 | 50 | Random | Ranked | Random moves |
| 1 | 1 | 50 | Material | Ranked | Basic material counting |
| 2 | 2 | 40 | Material | Ranked | 2-ply lookahead |
| 3 | 2 | 20 | Material+Positional | Ranked | Center awareness |
| 4 | 4 | 10 (flat) | Material+Positional | Ranked | Deeper search |
| 5 | 3 | 10 (flat) | BoardSense | Ranked | Quiescence, mobility |
| 6 | 3 | 10/7/5 | BoardSense+Concepts | Goal-Based | Strategic move ideas, ChessConcepts |
| 7 | 4 | 10/7/5/3 | BoardSense+Concepts | Goal-Based | Same as L6, one ply deeper, SEE |

---

## Key Files Reference

| File | Responsibility |
|---|---|
| `ChessBot.ts` | Bot configs, eval strategies, depth/move-gen strategies, `botMove()` |
| `MoveEval.ts` | `fromScratch`, `fromParent`, `_minimax`, `generateCandidateMoves`, SEE |
| `MoveIdeas.ts` | `MOVE_IDEAS` list with priorities and move generators |
| `BoardSense.ts` | `generateCapturesClassified`, `generateCaptures`, `computeAllAttackers`, `updateAttackersForMove` |
| `ChessConcepts.ts` | `DontBringQueenEarly`, `AvoidTradesWhenBehind`, `evaluateConcepts` |
| `SacrificeDetection.test.ts` | Regression test for Nxe4 sacrifice bug |
