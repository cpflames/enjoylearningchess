# Backlog

Ideas and improvements that aren't urgent but are worth doing eventually.

---

## Chess Bot Diagnostics

### MoveEval tree dump (`getTreeDump()`)
**What:** A method on `MoveEval` that recursively serializes the evaluated minimax tree as a structured object — move, initialScore, finalScore, line, and children.

**Why:** After `minimax()` runs, `topMoves` is populated at every tree node. Currently there's no way to walk the tree programmatically. A tree dump would let tests assert things like "at depth 2 after Nxe4, Bxf7 was ranked above dxe4 due to inflated initialScore" — useful for diagnosing subtle move-ordering bugs.

**Sketch:**
```ts
type MoveTreeNode = {
  move: string;
  initialScore: number;
  finalScore: number;
  line: string;
  children: MoveTreeNode[]; // top N searched children
};

getTreeDump(): MoveTreeNode { ... }
```

---

### FEN-based regression test runner
**What:** A data-driven test pattern — a list of `{ fen, level, shouldNotPlay, shouldPlay? }` objects that auto-generates `test()` calls, eliminating boilerplate for adding new regression cases.

**Why:** Every time the bot makes a strange move in practice, we want to add a regression test. Currently each regression requires writing a new `describe/test` block. A declarative list would make adding regressions instant.

**Sketch:**
```ts
// regressions.ts
export const REGRESSIONS = [
  {
    description: 'Does not sacrifice knight for defended pawn',
    fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 5',
    level: 7,
    shouldNotPlay: ['Nxe4'],
  },
  // add more as issues are discovered in play
];

// regressions.test.ts
for (const r of REGRESSIONS) {
  test(r.description, () => {
    expectBotNotToPlay(r.fen, r.level, r.shouldNotPlay[0]);
  });
}
```

---
