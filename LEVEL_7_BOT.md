# Level 7 Bot

## Overview
Added Level 7 bot, which is the same as Level 6 but with depth 4 instead of depth 3, providing stronger play at the cost of longer thinking time.

## Configuration

### Level 6 (Previous Strongest)
- **Depth**: 3
- **Breadth**: 10
- **Depth Strategy**: Quiescence (extends on captures)
- **Move Generation**: Goal-Based
- **Evaluation**: BoardSense Enhanced

### Level 7 (New Strongest)
- **Depth**: 4 ⬆️
- **Breadth**: 10
- **Depth Strategy**: Quiescence (extends on captures)
- **Move Generation**: Goal-Based
- **Evaluation**: BoardSense Enhanced

## Changes

### 1. Added Level 7 to BOT_CONFIGS
```typescript
makeBotConfig(7, 4, 10, QUIESCE_DEPTH, GOAL_BASED_MOVE_GEN, BOARDSENSE_STRATEGY)
```

### 2. Updated MAX_BOT_LEVEL
- Changed from 6 to 7
- UI automatically adapts (uses `MAX_BOT_LEVEL + 1` for dropdown)

### 3. Updated Tests
- Updated `ChessBot.test.ts` to expect 8 bot configs and MAX_BOT_LEVEL = 7
- Added test to verify Level 7 has depth 4
- Created `Level7Bot.test.ts` with comprehensive tests

## Performance Characteristics

### Search Depth Comparison
- **Level 6**: Searches 3 moves ahead (with quiescence extensions)
- **Level 7**: Searches 4 moves ahead (with quiescence extensions)

### Expected Performance
With breadth 10 and depth 4:
- **Theoretical max nodes**: 10^4 = 10,000
- **With alpha-beta pruning**: ~1,500-2,000 nodes (80-85% reduction)
- **Thinking time**: Approximately 2-3x longer than Level 6

## Testing

### New Test File: `Level7Bot.test.ts`
- ✓ Level 7 bot can make a move
- ✓ Level 7 bot has correct configuration
- ✓ Level 7 bot searches deeper than Level 6
- ✓ Level 7 bot can handle complex positions
- ✓ Level 7 bot can handle endgame positions
- ✓ Level 7 bot uses goal-based move generation

### Updated Tests
- ✓ ChessBot tests updated for 8 configs
- ✓ MAX_BOT_LEVEL test updated to expect 7
- ✓ All existing tests still pass

## Example Moves

### Starting Position
```
Move: Nc3
Evaluation: Strategic opening development
```

### Complex Middle Game
```
Position: r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4
Move: Bd3
Evaluation: Tactical positioning
```

### Endgame
```
Position: 4k3/8/8/8/8/8/4P3/4K3 w - - 0 1
Move: Kf2
Evaluation: King activation
```

## Bot Progression

| Level | Depth | Breadth | Strategy | Move Gen | Features |
|-------|-------|---------|----------|----------|----------|
| 0 | 1 | 50 | Random | Ranked | Random moves |
| 1 | 1 | 50 | Material | Ranked | Basic material |
| 2 | 2 | 40 | Material | Ranked | Looks ahead 2 moves |
| 3 | 2 | 20 | Material+Positional | Ranked | Position awareness |
| 4 | 4 | 10 | Material+Positional | Ranked | Deeper search |
| 5 | 3 | 10 | BoardSense | Ranked | Mobility, structure |
| 6 | 3 | 10 | BoardSense | Goal-Based | Strategic moves |
| 7 | 4 | 10 | BoardSense | Goal-Based | Deeper strategic search |

## Files Modified
- `onetris/src/components/ChessBot.ts` - Added Level 7 config
- `onetris/src/components/ChessBot.test.ts` - Updated tests
- `onetris/src/components/Level7Bot.test.ts` - New test file

## UI Changes
No UI changes needed - the dropdown automatically shows Level 7 because it uses `MAX_BOT_LEVEL + 1`.
