# UserScripts

Browser extension scripts (Greasemonkey/Tampermonkey) for enhancing third-party sites.

## ChessComStudyMode.user.js

**Target**: `https://www.chess.com/game/*`, analysis pages, collections

Hides the move list in Chess.com studies so you can practice without seeing upcoming moves. Injects CSS to hide `.analysis-view-movelist`, then inserts a "Show moves" link into `.analysis-view-scrollable`. Clicking the link reveals the moves and removes itself. Polls every second to re-insert the link after dynamic DOM updates.

## LichessStudyMode.user.js

**Target**: `https://lichess.org/study/*`

Same concept as the Chess.com script, adapted for Lichess selectors. Hides `.analyse__moves`, `.analyse__fork`, and white SVG arrow indicators (`g[cghash*="white"]`). A "Show moves" link is injected and clicked once to reveal everything. Polls every second to handle Lichess's dynamic page loads.

## CalendarColorizer.user.js

**Target**: Google Calendar month/week views (excludes event edit pages)

Applies monthly color palettes to Google Calendar and makes several UI tweaks:

- **Monthly palettes**: Each month has a unique color scheme (January = purple, February = pink, …, December = olive). Each palette defines four shades: faint background, today highlight, this-week highlight, and day number color.
- **Viewport height hack**: Adds 1000px to the document height so Google Calendar renders all events in the visible area.
- **UI hiding**: Removes the "Create" button, side panel, and navigation arrows for a cleaner display.
- **Cursor auto-hide**: Hides the mouse cursor after 5 seconds of inactivity.
- **Live updates**: A `MutationObserver` (100 ms debounce) re-applies colors whenever the DOM changes; a 10-second polling fallback handles edge cases.

Key helpers:

| Function | Purpose |
|---|---|
| `paletteGen(hex)` | Builds 4-shade RGBA palette from a 3-digit hex code |
| `hexToRGBA(hex, a)` | Converts `#RGB` → `rgba(r,g,b,a)` via bit shifting |
| `getDate(el)` / `getDatekey(date)` | Converts between Date objects and Google Calendar's custom `data-datekey` encoding |
| `colorDayBoxes()` | Colors calendar day cells by month context |
| `colorDayNumbers()` | Colors the numeric day headers |
| `updateEverything()` | Orchestrates all color and layout updates |
