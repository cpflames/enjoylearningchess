# Move King Endgame Feature

## Problem
The bot sometimes couldn't generate any candidate moves in sparse endgame positions (e.g., king vs king, king and pawn vs king). This caused the bot to fall back to considering all legal moves, which was inefficient.

## Solution
Added a "Move King" move idea that generates king moves specifically for endgame positions.

## Changes

### 1. New BoardSense Method: `generateKingMoves()`
```typescript
public generateKingMoves(color: Color): string[]
```
- Generates all legal king moves for a given color
- Uses existing `generatePieceDestinations()` and `squareToSAN()` methods
- Returns moves in SAN notation (e.g., "Kf1", "Ke2")

### 2. New Move Idea: "Move King"
Added to `MOVE_IDEAS` array in `MoveIdeas.ts`:
- **Name**: "Move King"
- **Description**: "Activate king in endgame"
- **Priority**: 60 (lower than tactical moves, higher than fallback)
- **Relevance**: Only in ENDGAME phase
- **Generates**: All legal king moves

### 3. Improved Phase Detection
Fixed `buildGameContext()` in `MoveEval.ts` to prioritize material over move number:

**Before:**
- If move ≤ 10: OPENING (even with low material)
- Else if material < 20: ENDGAME
- Else: MIDDLEGAME

**After:**
- If material < 20: ENDGAME (regardless of move number)
- Else if move ≤ 10: OPENING
- Else: MIDDLEGAME

This ensures that sparse endgame positions are correctly detected even at move 1.

## Testing

### New Test Files

#### `MoveKing.test.ts`
- ✓ generateKingMoves generates king moves
- ✓ generateKingMoves works in endgame position
- ✓ Move King idea is relevant in endgame
- ✓ Bot can find moves in sparse endgame position
- ✓ Bot does not fall back to all legal moves in endgame

#### `EndgameEdgeCases.test.ts`
- ✓ Bot can handle king vs king endgame
- ✓ Bot can handle king and pawn endgame
- ✓ Bot can handle rook endgame
- ✓ Bot never falls back to all legal moves
- ✓ Endgame phase is detected correctly based on material

### Results
All tests pass, including:
- 5 new MoveKing tests
- 5 new EndgameEdgeCases tests
- All existing ChessBot and GoalBasedMoves tests

## Examples

### King vs King Endgame
```
Position: 4k3/8/8/8/8/8/8/4K3 w - - 0 1
Candidates: [ 'Kf1', 'Kf2', 'Ke2', 'Kd2', 'Kd1' ]
Result: 5 strategic moves out of 5 legal moves
```

### King and Pawn Endgame
```
Position: 8/8/8/4k3/8/8/4P3/4K3 w - - 0 1
Candidates: [ 'Kf1', 'Kf2', 'Kd2', 'Kd1' ]
Result: 4 strategic moves out of 6 legal moves
```

### Rook Endgame
```
Position: 4k3/8/8/8/8/8/8/R3K3 w - - 0 1
Candidates: [ 'Kf1', 'Kf2', 'Ke2', 'Kd2', 'Kd1' ]
Result: 5 strategic moves out of 15 legal moves
```

## Benefits

1. **No More Empty Candidate Lists**: Bot always generates moves in endgame
2. **Strategic Selection**: Still selective about which moves to consider (not all legal moves)
3. **Correct Phase Detection**: Material-based detection works even at move 1
4. **Better Endgame Play**: King activation is a key endgame principle

## Files Modified
- `onetris/src/components/BoardSense.ts` - Added `generateKingMoves()` method
- `onetris/src/components/MoveIdeas.ts` - Added "Move King" move idea
- `onetris/src/components/MoveEval.ts` - Fixed phase detection logic
- `onetris/src/components/MoveKing.test.ts` - New test file
- `onetris/src/components/EndgameEdgeCases.test.ts` - New test file
