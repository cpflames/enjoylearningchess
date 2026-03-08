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

Runs daily via GitHub Actions (`.github/workflows/fetch-tournaments.yml`) at 8am UTC, or triggered manually via `workflow_dispatch`. Can also be run locally:
```bash
python fetcher.py          # incremental: stops when it hits a date already downloaded
python fetcher.py --all    # bypasses date-based early stop; individual files that already exist are still skipped
```

### What it does

1. Fetches `https://ratingsnw.com/tournreports.html`
2. Parses `table.report tr` rows — each row has: link to report, director, city, date
3. **Incremental check:** for each tournament, checks if any file with `YYYY-MM-DD_` prefix already exists in `output_dir`. If yes, stops immediately — the list is in reverse-chronological order so everything further down is also already downloaded
4. For new tournaments, fetches the individual HTML page and extracts every `<pre>` tag
5. Each `<pre>` is one section's rating report. The section name comes from the preceding `<h4>` tag (strips the "Rating report for " prefix)
6. Saves each section as `YYYY-MM-DD_SectionName.txt` in `../public/tournament_reports/`
7. After the loop, regenerates `index.json` — a reverse-sorted JSON array of all `.txt` filenames

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

**Note on file loading:** fetched `.txt` files are processed through `DOMParser` as HTML and `doc.querySelector('pre')?.textContent` is attempted first. Since `.txt` files have no `<pre>` tag, this is always `null` and falls back to the raw response text. The `<pre>` extraction is vestigial from when reports were stored as HTML pages.

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
| Rated Score | `player.ratedScore / ratedRounds` where `ratedRounds` = count of non-null opponents from `getOpponentRatings()` |
| Opponents | Opponent start ratings (null shown as round code, e.g. BYE) |
| Predicted Rating | `RatingsCalc.predictNewRating(...)` — links to `/ratings` |
| Difference | `endRating - predictedRating` (green/red) |

---

## 4. The Player Results Page — PlayerResults.tsx

**File:** `src/pages/PlayerResults.tsx`
**Route:** `/player-results`

Text input at the top (pre-filled from `?player=` URL param). On mount, fetches all report files exactly like TournamentFinder. As reports load, a progress counter shows `X / N` loaded.

Filtering is real-time: only reports whose text content contains the typed string (exact substring match, case-sensitive) are shown. Each match renders as a `<pre>` block with a link to `/results?savedReport=...`.

URL is updated via `history.replaceState` (not `pushState`) on each keystroke so the search is bookmarkable without polluting browser history.

Shows "No reports found for X" only after all reports have loaded and nothing matched.

---

## 5. The Finder Page — TournamentFinder.tsx

**File:** `src/pages/TournamentFinder.tsx`
**Route:** `/tournament-finder` (check `src/App.js` for exact route)

Loads all reports and renders them all as `<pre>` blocks. Each title is a link to `/results?savedReport=filename`.

Uses `fetchWithRetry` (3 attempts, exponential backoff: 1s → 2s → 4s) and fetches reports **sequentially** (via `reduce` over a promise chain) to avoid flooding the server.

---

## 6. The Parser — TournamentResults.ts

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

## 7. The Player Model — Player.ts

**File:** `src/types/Player.ts`

Simple data class. Constructor parses string inputs into typed fields.

Notable parsing:
- `endRating`: `parseInt(end.split('/')[0])` — defensive split handle if passed in `"end/games"` form, but `parseLine` splits those fields apart already so `end` is already just the number
- `numGames`: `parseInt(games.split('/')[1] || games)` — same defensive handling
- `ratedScore` getter: excludes any round containing `'F'` (covers `WF`, `LF`, `XF`, `F{n}`); counts `W` → +1, `D` → +0.5, anything else → 0
- `ratedRounds` getter: counts rounds starting with `W`, `D`, or `L` — **note:** this includes `WF` and `LF` since they start with `W`/`L`, making `ratedRounds` inconsistent with `ratedScore` for forfeit rounds

---

## Adding New Functionality

Key extension points:
- **New report source**: add a function to `fetcher.py` alongside `scrape_tournament_reports()`; write files to the same `public/tournament_reports/` directory and re-run index generation
- **Force full re-fetch**: run `python fetcher.py --all` to bypass incremental logic
- **Change schedule**: edit the `cron` expression in `.github/workflows/fetch-tournaments.yml`
- **New round codes**: update the scoring logic in `TournamentResults.ts:115-120` and the exclusion list in `getOpponentRatings` at `TournamentResults.ts:218`
- **New analysis columns**: add fields to `CommentaryRow` interface (`TournamentResults.ts:4`), populate in `generateCommentary` (`TournamentResults.ts:192`), render in Results.tsx table
- **New metadata per report**: the fetcher currently discards director/city after printing; those could be saved to a sidecar JSON or embedded in the filename
