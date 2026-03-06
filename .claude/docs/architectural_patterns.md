# Architectural Patterns

Patterns confirmed across multiple files in this codebase.

---

## 1. Strategy Pattern for Chess AI

Chess evaluation, depth control, and move generation are each encapsulated as static strategy objects, then composed into `BotConfig` entries.

- `src/components/ChessBot.ts:30` — `RANDOM_STRATEGY`, `MATERIAL_STRATEGY`, `BOARDSENSE_STRATEGY` (evalStrategy objects with `evalFunc` + `strategyName`)
- `src/components/ChessBot.ts:115` — `makeBotConfig()` factory composes strategies
- `src/components/ChessBot.ts:133` — `BOT_CONFIGS[]` array; bots accessed by index

When adding new bot behaviors, define a new strategy object and pass it to `makeBotConfig()` — do not branch inside the evaluation functions.

---

## 2. Module-Level Cache with Explicit Clear

Services keep an in-memory `Map` at module scope, keyed by a lookup string. All include a `clearCache()` export.

- `src/services/dictionaryService.ts:25` — `definitionCache: Map<string, DictionitionCacheEntry>`
- `src/services/ttsService.ts:20` — `audioCache: Map<string, AudioCacheEntry>`
- `src/components/BoardSense.ts:37` — `GLOBAL_BOARDSENSE_CACHE: Map<string, Map<string, any>>`

Cache entries include a timestamp for TTL checks. Follow the same pattern when adding new services that make external calls.

---

## 3. AbortController Timeout on Async Fetches

All external `fetch` calls use `AbortController` + `setTimeout` to enforce timeouts.

- `src/services/dictionaryService.ts:42-43` — 5s timeout
- `src/services/ttsService.ts:37-38` — 10s timeout

Pattern:
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), MS);
const response = await fetch(url, { signal: controller.signal });
clearTimeout(timeoutId);
```

Catch `AbortError` separately to show a timeout-specific error message.

---

## 4. Discriminated Union Types for API Contracts

API request and response shapes use a `type` discriminant field, defined in `src/types/chess-notation-ocr.ts`.

- `src/types/chess-notation-ocr.ts:7` — `WorkflowStatus = 'initiated' | 'stored' | 'processing' | 'completed' | 'failed'`
- `src/types/chess-notation-ocr.ts:46` — `ApiRequest` discriminated union
- `src/types/chess-notation-ocr.ts:73` — `ApiResponse` discriminated union
- `src/api/chessNotationOcrClient.ts` — consumes these types throughout

Define new API operations by extending the union types in `src/types/`, not by adding optional fields to existing interfaces.

---

## 5. Pages Own State, Components Are Reusable

Route-level pages (`src/pages/`) own and manage state; components (`src/components/`) receive props and emit callbacks.

- `src/pages/PlayChess.tsx` — reads URL params, passes `botLevel` down to `<ChessGame>`
- `src/components/ChessGame.tsx` — stateful UI component, but receives initial config from parent
- `src/pages/NotationUpload.tsx` — owns entire upload workflow state
- `src/components/WordEntry.tsx` — pure presentation, 13-prop interface

Do not fetch data or manage shared state inside `src/components/`; keep that in `src/pages/`.

---

## 6. Composite State with Immutable Spread Updates

Complex pages consolidate related state into an interface and update it with partial spreads.

- `src/pages/NotationUpload.tsx` — `NotationUploadState` interface with ~12 fields; updated via `setState(prev => ({ ...prev, ...updates }))`

Use this pattern when a component has 4+ closely related state fields that change together.

---

## 7. Progress/Status Callbacks for Async Operations

Long-running async functions accept optional callback parameters rather than returning intermediate values.

- `src/api/chessNotationOcrClient.ts:181` — `uploadToS3(... onProgress?: (progress: number) => void)`
- `src/api/chessNotationOcrClient.ts:269` — `pollWorkflowUntilComplete(... onStatusUpdate?: (status: GetStatusResponse) => void)`

Callers pass callbacks to update UI state; the async function stays decoupled from React.

---

## 8. URL Parameter State Sync

Bot level (and similar shareable UI state) is persisted in URL search params so links are bookmarkable.

- `src/pages/PlayChess.tsx:2,7` — reads `?level=` on mount via `useSearchParams()`
- `src/components/ChessGame.tsx:19,257` — writes back to `?level=` when user changes bot level

Use `useSearchParams()` from `react-router-dom` for any state the user might want to share or bookmark.

---

## 9. Retry with Exponential Backoff + Jitter

The OCR API client retries on transient errors with exponential delays and ±25% jitter to avoid thundering herd.

- `src/api/chessNotationOcrClient.ts:55` — `calculateBackoffDelay(attempt, baseDelay)` with jitter
- `src/api/chessNotationOcrClient.ts:68` — `isRetryableError()` checks status codes 408, 429, 5xx
- `src/api/chessNotationOcrClient.ts:126,131` — retry loop: rethrow on last attempt or non-retryable error

---

## 10. ValidationResult Pattern

Validation functions return a typed result object rather than throwing.

- `src/utils/fileValidator.ts:12,23` — `validateFile(file): ValidationResult` with `{ valid: boolean, error?: string }`

Follow this shape for any client-side validation. Throw only for programming errors, not user input errors.

---

## 11. Factory Methods for Stateful Objects

`MoveEval` uses named static factory methods to communicate the two construction contexts clearly.

- `src/components/MoveEval.ts` — `MoveEval.fromScratch()` and `MoveEval.fromParent()`

Prefer this over overloaded constructors when construction logic differs meaningfully by context.
