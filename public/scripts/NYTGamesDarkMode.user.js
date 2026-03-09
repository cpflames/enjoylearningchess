// ==UserScript==
// @name         NYT Games Dark Mode
// @namespace    cpflames
// @version      1.2
// @description  Applies a dark background to New York Times games
// @include      https://www.nytimes.com/games/*
// @include      https://www.nytimes.com/games/*/*
// @include      https://www.nytimes.com/puzzles/*
// @include      https://www.nytimes.com/puzzles/*/*
// ==/UserScript==

(function () {
  'use strict';

  function applyDarkMode() {
    var selectors = [
      'div.pz-game-field#pz-game-root',
      'div.GameMoment-module_gameContainer__Vuha8',
      'div.Tray-module_trayContainer__zSWYr',
    ];
    selectors.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) {
        el.style.backgroundColor = 'darkgrey';
      }
    });
  }

  setInterval(applyDarkMode, 1000);
})();
