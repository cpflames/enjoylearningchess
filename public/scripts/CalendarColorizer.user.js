// ==UserScript==
// @name         Google Calendar Colorizer
// @namespace    cpflames
// @description  Simple script to change the colors in Google Calendar.
// @updateURL    https://enjoylearningchess.com/scripts/CalendarColorizer.user.js
// @downloadURL  https://enjoylearningchess.com/scripts/CalendarColorizer.user.js
// @version      3.02
// @include      https://calendar.google.com/calendar/u/*/r/month
// @include      https://calendar.google.com/calendar/u/*/r/month/*
// @include      https://calendar.google.com/calendar/u/*/r/customweek
// @include      https://calendar.google.com/calendar/u/*/r/customweek/*
// @exclude      https://calendar.google.com/calendar/u/*/r/eventedit
// @exclude      https://calendar.google.com/calendar/u/*/r/eventedit/*
// @grant        none
// ==/UserScript==

// Color palettes for each month
const MONTH_PALETTES = [
  paletteGen("C0F"), // January - Winter Purple
  paletteGen("00F"), // February - Deep Blue
  paletteGen("093"), // March - Spring Green
  paletteGen("FC0"), // April - Yellow
  paletteGen("0FF"), // May - Teal
  paletteGen("F09"), // June - Purple
  paletteGen("F00"), // July - Red
  paletteGen("00F"), // August - Deep Blue
  paletteGen("9F0"), // September - Chartreuse
  paletteGen("F90"), // October - Orange
  paletteGen("842"), // November - Brown
  paletteGen("0AF"), // December - Winter Blue
];

// Debug mode flag
const DEBUG_MODE = false;

(function() {

// Generate CSS rules for all days in the week
const style = document.createElement('style');


style.textContent += `
/* Base styles for all day numbers */
.w48V4c.ubOFEd {
  position: absolute !important;
  right: 4px !important;
  top: 8px !important;
  z-index: 9999;
  transform: none !important;  /* Reset any transforms */
  color: white !important;
  border-radius: 50% !important;
  width: 32px !important;
  height: 32px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  text-shadow: 0 0 2px rgba(0,0,0,0.2);
  /* Add font size */
  font-size: 20px !important;
  font-weight: 500 !important;
  /* Reset any additional positioning */
  margin: 0 !important;
  padding: 0 !important;
}

/* Only add specific overrides for current day */
.w48V4c.ubOFEd.F262Ye {
  color: white !important;

  /* Remove any special styling */
  background-image: none !important;
}

/* Ensure parent context is correct */
.RCXPcd {
  position: relative;
  z-index: 1;
}

/* Keep events below */
.vEJ0bc.ChfiMc {
  z-index: 1 !important;
}
`;

style.textContent += `
div.T3BIT {
  margin-top: 5px !important;
}

/* Hide the "+" add event button */
[aria-label="Create"] {
  display: none !important;
}

/* Hide the "<" navigation button in bottom right */
[aria-label="Show side panel"] {
  display: none !important;
}

/* Hide the side panel on the right */
[aria-label="Side panel"] {
  display: none !important;
}
`;

style.textContent += `
/* Trick page into showing all calendar events */

/* 1000 pixels giveth */
html, body {
  height: calc(100vh + 1000px);
}

/* 1000 pixels taketh away */
div.kbf0gd {
  margin-bottom: 1000px !important;
}

/* Cursor hiding class */
body.hide-cursor * {
  cursor: none !important;
}
`;

// Inject the CSS rules into the page
document.head.appendChild(style);

// Cursor hiding logic
let cursorTimeout;
function resetCursorTimeout() {
    document.body.classList.remove('hide-cursor');
    clearTimeout(cursorTimeout);
    cursorTimeout = setTimeout(() => {
        document.body.classList.add('hide-cursor');
    }, 5000);
}

// Reset timer on any mouse movement
document.addEventListener('mousemove', resetCursorTimeout);

// Initial setup
resetCursorTimeout();

})();

function getDate(dateKey) {
const yearOffset = (dateKey - 32) % 512;
const year = (dateKey - 32 - yearOffset) / 512;
const day = yearOffset % 32;
const month = (yearOffset - day) / 32;
return new Date(year + 1970, month, day);
}

function getDatekey(date) {
const y = date.getFullYear() - 1970;
const m = date.getMonth()+1;    /* getMonth() returns 0-based index */
const d = date.getDate();
return (y<<9) + (m<<5) + d;
}

// Helper function for debug alerts
function debug(message) {
  if (DEBUG_MODE) {
      console.log("[Calendar Colorizer]", message);
  }
}

function paletteGen(colorHex) {
  return {
      faint: hexToRGBA(colorHex + "1"),
      today: hexToRGBA(colorHex + "9"),
      thisWeek: hexToRGBA(colorHex + "5"),
      dayNumbers: hexToRGBA(colorHex + "F")
  }
}

function hexToRGBA(hex) {
  // Remove the hash if it exists
  hex = hex.replace('#', '');

  // Parse the hex values
  let r, g, b, a

  r = parseInt(hex[0] + hex[0], 16);
  g = parseInt(hex[1] + hex[1], 16);
  b = parseInt(hex[2] + hex[2], 16);
  a = parseInt(hex[3] + hex[3], 16) / 500.0;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function colorDayBoxes() {
  const allDayBoxes = document.querySelectorAll('.MGaLHf.ChfiMc');
  debug('Updating day box colors');
  allDayBoxes.forEach(box => {
      box.style.backgroundColor = '';

      const dateKey = parseInt(box.getAttribute('data-datekey'));
      const date = getDate(dateKey);
      const month = date.getMonth();
      const palette = MONTH_PALETTES[month];
      debug('box ' + box.textContent + ': dateKey ' + dateKey + ' is in month ' + month);

      const today = new Date();
      const isToday = dateKey === getDatekey(today);

      const isThisWeek = dateKey >= getDatekey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())) &&
          dateKey <= getDatekey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - today.getDay())));

          if (isToday) {
            box.style.backgroundColor = palette.today;
            box.style.border = '1px solid white';
        } else if (isThisWeek) {
            box.style.backgroundColor = palette.thisWeek;
            box.style.border = '1px solid #1b1b1b';
        } else {
            box.style.backgroundColor = palette.faint;
            box.style.border = '1px solid #1b1b1b';
        }
  });
}

// Run initially
colorDayBoxes();

function colorDayNumbers() {
  const dayNumbers = document.querySelectorAll('h2[data-datekey]');
  if (!dayNumbers.length) {
      debug('No day numbers found, retrying in 100ms');
      setTimeout(colorDayNumbers, 500);
      return;
  }
  debug('Updating day number colors');

  dayNumbers.forEach(dayNumber => {
      dayNumber.style.backgroundColor = '';

      const dateKey = parseInt(dayNumber.getAttribute('data-datekey'));
      const date = getDate(dateKey);
      const month = date.getMonth();
      const palette = MONTH_PALETTES[month];
      debug('number ' + dayNumber.textContent + ': dateKey ' + dateKey + ' is in month ' + month);
      dayNumber.style.backgroundColor = palette.dayNumbers;
  });
}

// Call both functions when needed
function colorAll() {
  colorDayBoxes();
  colorDayNumbers();
}

// Run initially after a short delay to ensure DOM is ready
setTimeout(colorAll, 500);

// Single observer for all calendar updates
const colorObserver = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
      // Check if the month header changed
      if (mutation.target.getAttribute && mutation.target.getAttribute('data-date')) {
          debug('Month header changed');
          debug('New date: ' + mutation.target.getAttribute('data-date'));
      }
  }
  setTimeout(colorAll, 100);  // Add small delay after mutations
});

function initializeObservers() {
  colorObserver.observe(document.body, {
      childList: true,
      subtree: true
  });
  debug('Observers initialized');
}

// Start initialization
initializeObservers();

setInterval(colorAll, 10000); // Re-apply colors every 10 seconds