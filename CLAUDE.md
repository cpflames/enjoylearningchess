# OneTris — Claude Reference

## Project Overview
Multi-game educational/entertainment web app. Primary focus is chess with AI bot opponents (8 difficulty levels). Also includes Connect4, spelling tools, word etymology, and tournament ratings tracking.

## Tech Stack

**Frontend**
- React 18 + TypeScript (strict mode)
- React Router v6 (client-side routing, `src/App.js`)
- Create React App / react-scripts 5 (Webpack/Babel)
- chess.js 1.4 (move generation/validation), chessground 9 (board UI)

**Backend (AWS)**
- Lambda functions in `lambdas/` (Node.js 18)
- S3 (file storage), DynamoDB (persistence)
- Textract (chess notation OCR), Polly (text-to-speech)

**Testing**
- Jest + React Testing Library
- fast-check (property-based tests)

## Key Directories

| Path | Purpose |
|------|---------|
| `src/App.js` | Route definitions |
| `src/pages/` | Route-level components; own their state |
| `src/components/` | Reusable React components + chess AI logic |
| `src/components/ChessBot.ts` | Bot configs, evaluation strategies, minimax |
| `src/components/BoardSense.ts` | Tactical board analysis (68KB); global position cache |
| `src/components/MoveEval.ts` | Move evaluation; factory pattern |
| `src/api/` | API clients for Lambda endpoints |
| `src/services/` | Business logic services (caching, TTS, dictionary) |
| `src/types/` | Shared TypeScript interfaces and type aliases |
| `src/utils/` | Pure utility functions |
| `src/RatingsCalc/` | Elo ratings algorithm (TypeScript port of Fortran) |
| `lambdas/chess-notation-ocr/` | S3-triggered OCR pipeline |
| `lambdas/etymize/` | Word etymology Lambda |
| `lambdas/tts-polly/` | Text-to-speech Lambda |
| `infrastructure/` | AWS IaC scripts, DynamoDB/S3/IAM configs |

## Commands

```bash
npm start            # Dev server on port 8080
npm run build        # Production build → /build
npm test             # Run tests once (no watch)
npm run test:watch   # Watch mode
npm run test:ci      # CI mode (force-exit, no watch)
```

Lambda deployment: each `lambdas/<name>/deploy.sh` deploys that function independently.

## Additional Documentation

Check these files when working on relevant areas:

| File | When to read |
|------|-------------|
| `.claude/docs/architectural_patterns.md` | Before adding new services, components, API clients, or chess AI logic |
| `LEVEL_7_BOT.md` | Chess bot AI design decisions |
| `ATTACKERS_OPTIMIZATION.md` | BoardSense performance details |
| `MOVE_KING_ENDGAME.md` | King endgame evaluation logic |
| `AMPLIFY_SYNC_GUIDE.md` | Deployment and Amplify sync process |
