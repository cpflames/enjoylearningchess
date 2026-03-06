# Tournament Reports: How It Works

This document covers the full pipeline: scraping reports from ratingsnw.com, storing them as files, and displaying/analyzing them in the web app.

---

## Overview

```
ratingsnw.com/tournreports.html
        |
        v
scripts/fetcher.py          (run manually/locally)
        |
        v
public/tournament_reports/  (static files served by React app)
  ├── index.json            (sorted list of all filenames)
  └── YYYY-MM-DD_SectionName.txt  (one file per tournament section)
        |
        v
src/pages/Results.tsx       (main viewer: dropdown, analysis table)
src/pages/TournamentFinder.tsx  (preview list of all reports)
```

---

## 1. The Fetcher Script

**File:** `scripts/fetcher.py`

Run manually from the `scripts/` directory:
```bash
python fetcher.py
```

### What it does

1. Fetches `https://ratingsnw.com/tournreports.html`
2. Parses `table.report tr` rows — each row has: link to report, director, city, date
3. For each tournament page, fetches the individual HTML and extracts every `<pre>` tag
4. Each `<pre>` is one section's rating report. The section name comes from the preceding `<h4>` tag (strips the "Rating report for " prefix)
5. Saves each section as `YYYY-MM-DD_SectionName.txt` in `../public/tournament_reports/`
6. After all downloads, writes `index.json` — a reverse-sorted JSON array of all `.txt` filenames

### Politeness
- Random 1–3 second delay between tournament fetches
- No parallelism

### Output filename format
```
2025-03-08_Sioux_Falls_Tournament_3-8-25_Section_Reserve.txt
```
- Date parsed from the table's date column (`%b %d, %Y` or `%B %d, %Y`)
- Section name: spaces and `/` replaced with `_`

### index.json
```json
[
  "2025-03-08_SectionA.txt",
  "2025-01-11_SectionB.txt",
  ...
]
```
Sorted reverse-alphabetically (newest first, since filenames start with dates).

---

## 2. The Stored Files

**Directory:** `public/tournament_reports/`

Each `.txt` file contains the raw pre-formatted text copied from the `<pre>` tag on ratingsnw.com. Format:

```
pos last name first       id numb   start end/#gms  rd1 rd2 rd3 rd4 rd5 tot
  1 Rachiba, Alisa         EVPEK08E  1147  1239/197  W31 W12 W10 W2  W3  5.0
  2 Li, Anyi               LKDDJ55F  1274  1271/134  W32 W6  W5  L1  W7  4.0
```

Columns:
- `pos` — finish position
- `last name first` — `LastName, FirstName`
- `id numb` — 8-char USCF ID (`[A-Z0-9]{5}[0-9]{2}[A-Z0-9]`)
- `start` — rating before the tournament
- `end/#gms` — new rating / total rated games in history
- `rd1..rdN` — round results (`W4` = won vs player 4, `L2` = lost vs player 2, `D3` = drew, `BYE`, `HPB`, `ZPB`, `WF`, `LF`, `U`, `X...`, `F...`)
- `tot` — total score (`n.n` format)

---

## 3. The Viewer Page — Results.tsx

**File:** `src/pages/Results.tsx`
**Route:** `/results`

### State
- `ratingsReport: string` — raw text currently in the textarea
- `results: TournamentResults` — parsed/analyzed object
- `reports: string[]` — list of filenames from `index.json`

### On mount
Fetches `/tournament_reports/index.json` and populates the dropdown.

If `?savedReport=filename` is in the URL, also fetches that file and loads it immediately.

### User inputs
Three ways to load a report:

| Method | How |
|--------|-----|
| Dropdown | Select from `index.json` list; fetches the `.txt` file |
| Arrow buttons | Cycle prev/next through `reports[]` with wraparound |
| Textarea | Paste any report text manually, then click "Check My Results" |

All three paths end up calling `setResults(new TournamentResults(text))`.

### URL state
- Dropdown/arrow selection: sets `?savedReport=encodedFilename` via `history.pushState`
- "Generate Permalink": encodes textarea content into `?ratingsReport=...`

### Analysis table
Rendered from `results.getCommentary()`. Columns:

| Column | Source |
|--------|--------|
| Player | `player.fullName` |
| Start Rating | `player.startRating` |
| End Rating | `player.endRating` |
| Change | `endRating - startRating` (green/red) |
| Score | `player.totalScore` |
| Rated Score | `player.ratedScore / ratedRounds` (excludes forfeits/byes) |
| Opponents | Opponent start ratings (null shown as round code, e.g. BYE) |
| Predicted Rating | `RatingsCalc.predictNewRating(...)` — links to `/ratings` |
| Difference | `endRating - predictedRating` (green/red) |

---

## 4. The Finder Page — TournamentFinder.tsx

**File:** `src/pages/TournamentFinder.tsx`
**Route:** `/tournament-finder` (check `src/App.js` for exact route)

Loads all reports and renders them all as `<pre>` blocks. Each title is a link to `/results?savedReport=filename`.

Uses `fetchWithRetry` (3 attempts, exponential backoff: 1s → 2s → 4s) and fetches reports **sequentially** (via `reduce` over a promise chain) to avoid flooding the server.

---

## 5. The Parser — TournamentResults.ts

**File:** `src/types/TournamentResults.ts`

Constructor takes raw report text and immediately parses it. All results are then accessed via getters.

### Parsing flow (`parseReport`)

1. **Header check** (`parseHeader`): verifies required columns are present in order (`pos`, `last name first`, `id numb`, `start`, `tot`), then counts rounds by finding `rd1`, `rd2`, etc.
2. **Line parsing** (`parseLine`): for each non-blank line after the header:
   - Anchors on the 8-char USCF ID regex: `/[A-Z0-9]{5}[0-9]{2}[A-Z0-9]\s/`
   - Left of ID: position + name
   - Right of ID: split on `[\s/-]+` → `[startRating, endRating, numGames, ...rounds]`
   - Last 3 chars of the line: total score (`n.n`)
   - Validates calculated score matches reported total
   - Pads missing rounds with `"U"` and emits a warning
3. **Position validation**: each player's `pos` must match their index in the array
4. Commentary is generated only if there are no errors

### Round codes recognized

| Code | Meaning | Counts as |
|------|---------|-----------|
| `W{n}` | Win vs player n | 1 pt (rated) |
| `L{n}` | Loss vs player n | 0 pts (rated) |
| `D{n}` | Draw vs player n | 0.5 pts (rated) |
| `BYE` | Full-point bye | 1 pt (unrated) |
| `HPB` | Half-point bye | 0.5 pts (unrated) |
| `ZPB` | Zero-point bye | 0 pts (unrated) |
| `WF` / `LF` | Win/loss by forfeit | unrated |
| `X{n}` | Unrated win | unrated |
| `F{n}` | Unrated loss | unrated |
| `U` | Unpaired/missing | 0 pts (unrated) |

### Key outputs
- `getCommentary()` → `CommentaryRow[]` (used by Results.tsx table)
- `getOpponentRatings(player)` → `(number | null)[]` (null for byes/forfeits)
- `getPredictedRating(player)` → calls `RatingsCalc.predictNewRating(startRating, opponentRatings, ratedScore)`
- `getErrors()` / `getWarnings()` → shown as banners in Results.tsx

---

## 6. The Player Model — Player.ts

**File:** `src/types/Player.ts`

Simple data class. Constructor parses string inputs into typed fields.

Notable parsing:
- `endRating`: splits `"1239/197"` on `/` and takes the first part
- `numGames`: takes the second part of that same `"end/games"` field
- `ratedScore` getter: excludes forfeit wins (`WF`, `XF`, etc.) — only counts `W`, `D`, `L` rounds
- `ratedRounds` getter: counts only `W`, `D`, `L` rounds

---

## Adding New Functionality

Key extension points:
- **New report source**: add a function to `fetcher.py` alongside `scrape_tournament_reports()`; write files to the same `public/tournament_reports/` directory and re-run index generation
- **New round codes**: update the scoring logic in `TournamentResults.ts:115-120` and the exclusion list in `getOpponentRatings` at `TournamentResults.ts:218`
- **New analysis columns**: add fields to `CommentaryRow` interface (`TournamentResults.ts:4`), populate in `generateCommentary` (`TournamentResults.ts:192`), render in Results.tsx table
- **New metadata per report**: the fetcher currently discards director/city after printing; those could be saved to a sidecar JSON or embedded in the filename
