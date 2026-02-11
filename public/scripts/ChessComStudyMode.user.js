// ==UserScript==
// @name         Chess-com Study Mode
// @namespace    cpflames
// @description  Simple script to hide the upcoming moves in a study
// @version      1.2
// @include      https://www.chess.com/game/*
// @include      https://www.chess.com/analysis/game/*
// @include      https://www.chess.com/analysis/collection/*/*/analysis
// @grant        none
// ==/UserScript==

(function() {
  // Add CSS rule to hide moves initially
  const style = document.createElement('style');
  style.textContent = `
      .analysis-view-movelist {
          display: none;
      }

      .analysis-view-movelist.show-moves {
          display: block !important;
      }
  `;
  document.head.appendChild(style);

  // Function to create a new show moves link
  function createShowMovesLink() {
      const showMovesLink = document.createElement('a');
      showMovesLink.href = '#';
      showMovesLink.textContent = 'Show moves';
      showMovesLink.style.cursor = 'pointer';
      showMovesLink.style.marginLeft = '1em';
      showMovesLink.classList.add('show-moves-link'); // Add class for identification

      showMovesLink.addEventListener('click', (e) => {
          e.preventDefault();
          const moves = document.querySelector('.analysis-view-movelist');
          if (moves) moves.classList.add('show-moves');
          showMovesLink.remove();
      });

      return showMovesLink;
  }

  // Function to check and insert link if needed
  function tryInsertLink() {
      const toolsDiv = document.querySelector('.analysis-view-scrollable');
      if (toolsDiv && !toolsDiv.querySelector('.show-moves-link')) {
          toolsDiv.appendChild(createShowMovesLink());
      }
  }

  // Run the check every second
  setInterval(tryInsertLink, 1000);

  // Also run immediately
  tryInsertLink();
})();